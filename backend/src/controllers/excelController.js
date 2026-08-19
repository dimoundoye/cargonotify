const ExcelJS = require('exceljs');
const pool = require('../config/db');

function getEffectiveCompanyId(req) {
  if (req.user && req.user.role === 'super_admin' && req.query.company_id) {
    return parseInt(req.query.company_id, 10);
  }
  return (req.user && req.user.company_id) ? req.user.company_id : 1;
}

// Utilitaire d'extraction ultra-robuste des nombres Excel (gère les entiers, décimales, séparateurs de milliers espaces/points/virgules, formules et formats de devises)
function parseExcelNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  if (typeof val === 'object') {
    if (val.result !== undefined && val.result !== null) {
      if (typeof val.result === 'object' && val.result.error) return 0;
      return parseExcelNum(val.result);
    }
    if (val.text !== undefined && val.text !== null) return parseExcelNum(val.text);
    if (val.value !== undefined && val.value !== null) return parseExcelNum(val.value);
    return 0;
  }

  let s = String(val).trim();
  if (!s) return 0;

  // Nettoyer tous les espaces (y compris les espaces insécables Excel \u00A0)
  s = s.replace(/\s/g, '').replace(/\u00A0/g, '');

  // Conserver uniquement les chiffres, points, virgules et le signe moins
  s = s.replace(/[^\d.,\-]/g, '');
  if (!s) return 0;

  // Cas A : Contient à la fois un point '.' et une virgule ',' (ex: "150.000,50" ou "150,000.50")
  if (s.includes('.') && s.includes(',')) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Format européen : "150.000,50" -> le point est le séparateur de milliers, la virgule la décimale
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Format US : "150,000.50" -> la virgule est le séparateur de milliers, le point la décimale
      s = s.replace(/,/g, '');
    }
  } 
  // Cas B : Contient uniquement des points '.' (ex: "150.000" ou "1.500.000" ou "12.5")
  else if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length > 2) {
      // Plusieurs points comme "1.500.000" -> séparateurs de milliers
      s = parts.join('');
    } else if (parts[1] && parts[1].length === 3 && parts[0].length >= 1) {
      // Un seul point suivi d'exactement 3 chiffres comme "150.000" -> séparateur de milliers !
      s = parts.join('');
    }
  } 
  // Cas C : Contient uniquement des virgules ',' (ex: "150,000" ou "12,5")
  else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length > 2) {
      // Plusieurs virgules comme "1,500,000" -> séparateurs de milliers
      s = parts.join('');
    } else if (parts[1] && parts[1].length === 3 && parts[0].length >= 1) {
      // Une seule virgule suivie d'exactement 3 chiffres comme "150,000" -> séparateur de milliers !
      s = parts.join('');
    } else {
      // Sinon ex: "12,5" -> la virgule est une décimale
      s = s.replace(',', '.');
    }
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

// Importation d'un fichier Excel type Classeur.xlsx avec Détection et Confirmation de Doublons
async function importContainerExcel(req, res) {
  const client = await pool.connect();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier Excel (.xlsx) requis.' });
    }

    const companyId = getEffectiveCompanyId(req);
    const confirmDuplicates = req.body.confirm_duplicates === 'true';

    let resolutions = {};
    if (req.body.resolutions) {
      try {
        resolutions = typeof req.body.resolutions === 'string' ? JSON.parse(req.body.resolutions) : req.body.resolutions;
      } catch (e) {
        resolutions = {};
      }
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: 'Aucune feuille de calcul valide trouvée dans le fichier Excel.' });
    }

    const totalRows = worksheet.rowCount;

    // --- ÉTAPE 1 : Détection des noms de clients identiques ---
    if (!confirmDuplicates) {
      const excelClientNames = new Set();
      for (let r = 4; r <= totalRows; r++) {
        const row = worksheet.getRow(r);
        const nameRaw = String(row.getCell(1).value || '').trim();
        if (nameRaw && nameRaw.toUpperCase() !== 'TOTAL' && !nameRaw.toUpperCase().includes('TABLEAU')) {
          excelClientNames.add(nameRaw);
        }
      }

      const matchingClients = [];
      for (const name of excelClientNames) {
        const matchRes = await client.query(
          'SELECT id, name, phone FROM clients WHERE name ILIKE $1 AND company_id = $2 LIMIT 1',
          [name, companyId]
        );
        if (matchRes.rows.length > 0) {
          matchingClients.push({
            excel_name: name,
            existing_id: matchRes.rows[0].id,
            existing_name: matchRes.rows[0].name,
            existing_phone: matchRes.rows[0].phone
          });
        }
      }

      if (matchingClients.length > 0) {
        return res.json({
          requires_confirmation: true,
          matches: matchingClients,
          message: `Attention : ${matchingClients.length} client(s) sur le fichier Excel ont un nom identique à des clients déjà enregistrés.`
        });
      }
    }

    // --- ÉTAPE 2 : Traitement de l'importation DB ---
    await client.query('BEGIN');

    // Extraction des informations d'en-tête (Ligne 1)
    const row1 = worksheet.getRow(1);
    const rawContainerNo = String(row1.getCell(1).value || '').trim() || `CONT-${Date.now().toString().slice(-6)}`;
    const blNumber = String(row1.getCell(2).value || '').trim() || null;
    const shippingLine = String(row1.getCell(4).value || '').trim() || null;
    const warehouseText = String(row1.getCell(6).value || '').trim() || '';
    const agentName = String(row1.getCell(9).value || '').trim() || null;

    let warehouseId = null;
    if (warehouseText) {
      const whResult = await client.query("SELECT id FROM warehouses WHERE name ILIKE $1 AND company_id = $2 LIMIT 1", [`%${warehouseText}%`, companyId]);
      if (whResult.rows.length > 0) {
        warehouseId = whResult.rows[0].id;
      } else {
        const whDef = await client.query("SELECT id FROM warehouses WHERE company_id = $1 ORDER BY id ASC LIMIT 1", [companyId]);
        if (whDef.rows.length > 0) warehouseId = whDef.rows[0].id;
      }
    }

    let containerId;
    const contCheck = await client.query('SELECT id FROM containers WHERE container_number = $1 AND company_id = $2', [rawContainerNo, companyId]);
    if (contCheck.rows.length > 0) {
      containerId = contCheck.rows[0].id;
      // Nettoyer les anciens lots lors du ré-import pour éviter les doublons
      await client.query('DELETE FROM lots WHERE container_id = $1 AND company_id = $2', [containerId, companyId]);
      await client.query(`
        UPDATE containers 
        SET bl_number = COALESCE($1, bl_number),
            shipping_line = COALESCE($2, shipping_line),
            agent_name = COALESCE($3, agent_name),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND company_id = $5
      `, [blNumber, shippingLine, agentName, containerId, companyId]);
    } else {
      const newCont = await client.query(`
        INSERT INTO containers (company_id, container_number, bl_number, shipping_line, agent_name, origin, status)
        VALUES ($1, $2, $3, $4, $5, 'Chine (Guangzhou)', 'arrived')
        RETURNING id
      `, [companyId, rawContainerNo, blNumber, shippingLine, agentName]);
      containerId = newCont.rows[0].id;
    }

    let lotsCreated = 0;

    for (let r = 4; r <= totalRows; r++) {
      const row = worksheet.getRow(r);
      const clientNameRaw = String(row.getCell(1).value || '').trim();

      if (!clientNameRaw || clientNameRaw.toUpperCase() === 'TOTAL' || clientNameRaw.toUpperCase().includes('TABLEAU')) {
        continue;
      }

      const cbm = parseExcelNum(row.getCell(2).value);
      const pkgs = Math.max(1, Math.round(parseExcelNum(row.getCell(3).value)));
      const cbmRate = parseExcelNum(row.getCell(5).value) || 150000;
      const cbmAmountExcel = parseExcelNum(row.getCell(6).value);
      const cbmAmount = cbmAmountExcel > 0 ? cbmAmountExcel : (cbm * cbmRate);

      const baleQty = Math.round(parseExcelNum(row.getCell(4).value));
      const baleRate = parseExcelNum(row.getCell(7).value) || 10000;
      const baleAmountExcel = parseExcelNum(row.getCell(8).value);
      const baleAmount = baleAmountExcel > 0 ? baleAmountExcel : (baleQty * baleRate);

      const copyQty = parseExcelNum(row.getCell(9).value);
      const copyRate = parseExcelNum(row.getCell(10).value) || 6000;
      const copyAmountExcel = parseExcelNum(row.getCell(11).value);
      const copyAmount = copyAmountExcel > 0 ? copyAmountExcel : (copyQty * copyRate);

      const smallPackingQty = Math.round(parseExcelNum(row.getCell(12).value));
      const smallPackingRate = parseExcelNum(row.getCell(13).value) || 1000;
      const smallPackingAmountExcel = parseExcelNum(row.getCell(14).value);
      const smallPackingAmount = smallPackingAmountExcel > 0 ? smallPackingAmountExcel : (smallPackingQty * smallPackingRate);

      const calculatedSum = cbmAmount + baleAmount + copyAmount + smallPackingAmount;
      const totalGeneralExcel = parseExcelNum(row.getCell(15).value);
      const totalGeneralVal = totalGeneralExcel > 0 ? totalGeneralExcel : calculatedSum;

      const statusCell = String(row.getCell(16).value || '').trim().toUpperCase();
      const exitDateStr = String(row.getCell(17).value || '').trim() || null;

      const paymentStatus = (statusCell === 'OK' || statusCell === 'SOLDE' || statusCell === 'PAYE') ? 'paid' : 'unpaid';
      const pickupStatus = (exitDateStr || statusCell === 'OK') ? 'picked_up' : 'pending';

      let clientId;
      const userChoice = resolutions[clientNameRaw] || 'existing';

      const clientCheck = await client.query('SELECT id FROM clients WHERE name ILIKE $1 AND company_id = $2', [clientNameRaw, companyId]);

      if (clientCheck.rows.length > 0 && userChoice === 'existing') {
        clientId = clientCheck.rows[0].id;
      } else {
        // Enregistrement d'un nouveau client (même si le nom est similaire s'il a choisi 'new')
        const defaultPhone = '+221 ';
        const newClient = await client.query(`
          INSERT INTO clients (company_id, name, phone) VALUES ($1, $2, $3) RETURNING id
        `, [companyId, clientNameRaw, defaultPhone]);
        clientId = newClient.rows[0].id;
      }

      const insertedLot = await client.query(`
        INSERT INTO lots (
          company_id, container_id, client_id, warehouse_id, product_description,
          quantity, volume_cbm, cbm_rate, cbm_amount,
          bale_qty, bale_amount, copy_qty, copy_amount,
          small_packing_qty, small_packing_amount,
          suggested_amount, final_amount, payment_status, pickup_status, exit_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING id
      `, [
        companyId,
        containerId,
        clientId,
        warehouseId,
        `Marchandise Groupage (${pkgs} colis)`,
        pkgs,
        cbm,
        cbmRate,
        cbmAmount,
        baleQty,
        baleAmount,
        copyQty,
        copyAmount,
        smallPackingQty,
        smallPackingAmount,
        totalGeneralVal,
        totalGeneralVal,
        paymentStatus,
        pickupStatus,
        exitDateStr
      ]);

      const lotId = insertedLot.rows[0].id;

      // Si le lot importé est marqué comme solde/payé, enregistrer automatiquement l'encaissement dans payments
      if (paymentStatus === 'paid' && totalGeneralVal > 0) {
        const receiptNumber = `REC-IMPORT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
        await client.query(`
          INSERT INTO payments (company_id, lot_id, client_id, amount_paid, payment_method, receipt_number, notes)
          VALUES ($1, $2, $3, $4, 'cash', $5, 'Règlement solde importé (Excel)')
        `, [companyId, lotId, clientId, totalGeneralVal, receiptNumber]);
      }

      lotsCreated++;
    }

    // Vérifier si tous les lots du conteneur importé sont réglés pour passer le conteneur en 'closed'
    const containerLots = await client.query('SELECT payment_status FROM lots WHERE container_id = $1 AND company_id = $2', [containerId, companyId]);
    if (containerLots.rows.length > 0 && containerLots.rows.every(r => r.payment_status === 'paid')) {
      await client.query(`
        UPDATE containers 
        SET status = 'closed', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1 AND company_id = $2
      `, [containerId, companyId]);
    }

    await client.query('COMMIT');

    return res.json({
      message: `Importation réussie ! Conteneur ${rawContainerNo} et ${lotsCreated} lot(s) client(s) créés avec succès.`,
      container_id: containerId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur importContainerExcel:', err);
    return res.status(500).json({ error: `Erreur lors de l'importation Excel : ${err.message}` });
  } finally {
    client.release();
  }
}

// Exportation d'un conteneur au format Excel stylisé avec valeurs numériques exactes et format #,##0 "CFA"
async function exportContainerExcel(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);

    const containerQuery = await pool.query('SELECT * FROM containers WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (containerQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Conteneur introuvable.' });
    }
    const container = containerQuery.rows[0];

    const lotsQuery = await pool.query(`
      SELECT 
        l.*,
        cl.name AS client_name,
        cl.phone AS client_phone,
        w.name AS warehouse_name
      FROM lots l
      JOIN clients cl ON l.client_id = cl.id
      LEFT JOIN warehouses w ON l.warehouse_id = w.id
      WHERE l.container_id = $1 AND l.company_id = $2
      ORDER BY l.id ASC
    `, [id, companyId]);
    const lots = lotsQuery.rows;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('RECAPITULATIF CONTENEUR');

    worksheet.columns = [
      { key: 'client', width: 26 },
      { key: 'cbm', width: 10 },
      { key: 'pkgs', width: 22 },
      { key: 'bale', width: 10 },
      { key: 'pu_cbm', width: 18 },
      { key: 'tot_cbm', width: 20 },
      { key: 'pu_bale', width: 18 },
      { key: 'tot_bale', width: 18 },
      { key: 'copy', width: 10 },
      { key: 'pu_copy', width: 18 },
      { key: 'tot_copy', width: 18 },
      { key: 'small_pack', width: 22 },
      { key: 'pu_small', width: 16 },
      { key: 'tot_small', width: 20 },
      { key: 'tot_gen', width: 22 },
      { key: 'statut', width: 12 },
      { key: 'remarques', width: 24 }
    ];

    const r1 = worksheet.getRow(1);
    r1.height = 24;

    r1.getCell(1).value = container.container_number;
    r1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
    r1.getCell(1).font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    r1.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    r1.getCell(2).value = container.bl_number || 'B/L SHZ7825000 25/01/2026';
    r1.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
    r1.getCell(2).font = { name: 'Calibri', bold: true, color: { argb: 'FF006100' }, size: 10 };
    r1.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

    r1.getCell(4).value = container.shipping_line || '76CMA';
    r1.getCell(4).font = { name: 'Calibri', bold: true, size: 10 };
    r1.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

    r1.getCell(6).value = container.origin || 'Chine (Guangzhou)';
    r1.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    r1.getCell(6).font = { name: 'Calibri', bold: true, color: { argb: 'FFC65911' }, size: 10 };
    r1.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

    r1.getCell(9).value = container.agent_name || 'BABACAR CISSE';
    r1.getCell(9).font = { name: 'Calibri', bold: true, size: 10 };
    r1.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.addRow([]);

    const headerRow = worksheet.getRow(3);
    headerRow.height = 26;
    headerRow.values = [
      'NOM CLIENT',
      'CBM',
      'PKGS/ NOMBRE DE COLIS',
      'BALE',
      'PRIX UNITAIRE CBM',
      'MONTANT TOTAL',
      'PRIX UNITAIRE BALE',
      'TOTAL BALES',
      'COPY',
      'PRIX UNITAIRE COPY',
      'TOTAL COPY',
      'SMALL PACKING (SACS)',
      'PRIX UNITAIRE',
      'TOTAL SMALL PACKING',
      'TOTAL GENERAL',
      'STATUT',
      'REMARQUES'
    ];

    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
      };
    });

    headerRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
    headerRow.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B365D' } };

    let sumCbm = 0;
    let sumPkgs = 0;
    let sumCbmAmount = 0;
    let sumBaleAmount = 0;
    let sumCopyAmount = 0;
    let sumSmallPackingAmount = 0;
    let sumTotalGeneral = 0;

    let currentRowIdx = 4;

    lots.forEach((lot) => {
      const cbm = parseFloat(lot.volume_cbm || 0);
      const pkgs = parseInt(lot.quantity || 1, 10);
      const cbmRate = parseFloat(lot.cbm_rate || 150000);
      const cbmAmt = lot.cbm_amount ? parseFloat(lot.cbm_amount) : (cbm * cbmRate);

      const baleQty = parseInt(lot.bale_qty || 0, 10);
      const baleAmt = parseFloat(lot.bale_amount || 0);

      const copyQty = parseFloat(lot.copy_qty || 0);
      const copyAmt = parseFloat(lot.copy_amount || 0);

      const spQty = parseInt(lot.small_packing_qty || 0, 10);
      const spAmt = parseFloat(lot.small_packing_amount || 0);

      const totalGen = parseFloat(lot.final_amount || 0);

      sumCbm += cbm;
      sumPkgs += pkgs;
      sumCbmAmount += cbmAmt;
      sumBaleAmount += baleAmt;
      sumCopyAmount += copyAmt;
      sumSmallPackingAmount += spAmt;
      sumTotalGeneral += totalGen;

      const dataRow = worksheet.getRow(currentRowIdx);
      dataRow.height = 20;

      dataRow.getCell(1).value = lot.client_name;
      dataRow.getCell(2).value = cbm;
      dataRow.getCell(3).value = pkgs;
      dataRow.getCell(4).value = baleQty || '';
      dataRow.getCell(5).value = cbmRate;
      dataRow.getCell(5).numFmt = '#,##0 "CFA"';
      dataRow.getCell(6).value = cbmAmt;
      dataRow.getCell(6).numFmt = '#,##0 "CFA"';
      dataRow.getCell(7).value = 10000;
      dataRow.getCell(7).numFmt = '#,##0 "CFA"';
      dataRow.getCell(8).value = baleAmt;
      dataRow.getCell(8).numFmt = '#,##0 "CFA"';
      dataRow.getCell(9).value = copyQty || '';
      dataRow.getCell(10).value = 6000;
      dataRow.getCell(10).numFmt = '#,##0 "CFA"';
      dataRow.getCell(11).value = copyAmt;
      dataRow.getCell(11).numFmt = '#,##0 "CFA"';
      dataRow.getCell(12).value = spQty || '';
      dataRow.getCell(13).value = 1000;
      dataRow.getCell(13).numFmt = '#,##0 "CFA"';
      dataRow.getCell(14).value = spAmt;
      dataRow.getCell(14).numFmt = '#,##0 "CFA"';
      dataRow.getCell(15).value = totalGen;
      dataRow.getCell(15).numFmt = '#,##0 "CFA"';
      dataRow.getCell(16).value = lot.payment_status === 'paid' ? 'OK' : 'EN ATTENTE';
      dataRow.getCell(17).value = lot.exit_date || '';

      dataRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 9 };
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
        };
      });

      dataRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
      dataRow.getCell(6).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF375623' } };

      dataRow.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      dataRow.getCell(15).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1F4E79' } };

      if (lot.payment_status === 'paid') {
        dataRow.getCell(16).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
        dataRow.getCell(16).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF375623' } };
      }

      currentRowIdx++;
    });

    const totalRow = worksheet.getRow(currentRowIdx);
    totalRow.height = 24;
    totalRow.getCell(1).value = 'TOTAL';
    totalRow.getCell(2).value = sumCbm;
    totalRow.getCell(3).value = sumPkgs;
    totalRow.getCell(6).value = sumCbmAmount;
    totalRow.getCell(6).numFmt = '#,##0 "CFA"';
    totalRow.getCell(8).value = sumBaleAmount;
    totalRow.getCell(8).numFmt = '#,##0 "CFA"';
    totalRow.getCell(11).value = sumCopyAmount;
    totalRow.getCell(11).numFmt = '#,##0 "CFA"';
    totalRow.getCell(14).value = sumSmallPackingAmount;
    totalRow.getCell(14).numFmt = '#,##0 "CFA"';
    totalRow.getCell(15).value = sumTotalGeneral;
    totalRow.getCell(15).numFmt = '#,##0 "CFA"';

    totalRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF1F4E79' } },
        bottom: { style: 'double', color: { argb: 'FF1F4E79' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    totalRow.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    totalRow.getCell(15).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF276A3C' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Recap-${container.container_number}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Erreur exportContainerExcel:', err);
    return res.status(500).json({ error: 'Erreur lors de la génération du fichier Excel.' });
  }
}

module.exports = {
  importContainerExcel,
  exportContainerExcel
};
