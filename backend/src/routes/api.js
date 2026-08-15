const express = require('express');
const multer = require('multer');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

const { authenticateToken, requireRole } = require('../middleware/auth');
const authController = require('../controllers/authController');
const containerController = require('../controllers/containerController');
const clientController = require('../controllers/clientController');
const lotController = require('../controllers/lotController');
const paymentController = require('../controllers/paymentController');
const whatsappController = require('../controllers/whatsappController');
const dashboardController = require('../controllers/dashboardController');
const statsController = require('../controllers/statsController');
const pricingController = require('../controllers/pricingController');
const excelController = require('../controllers/excelController');
const userController = require('../controllers/userController');
const settingsController = require('../controllers/settingsController');
const companyController = require('../controllers/companyController');
const expenseController = require('../controllers/expenseController');
const auditController = require('../controllers/auditController');

// --- Auth Routes ---
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticateToken, authController.getMe);
router.post('/auth/change-password', authenticateToken, authController.changePassword);

// --- SaaS Platform Companies Routes (Super Admin) ---
router.get('/companies', authenticateToken, requireRole('super_admin'), companyController.getCompanies);
router.post('/companies', authenticateToken, requireRole('super_admin'), companyController.createCompany);
router.put('/companies/:id', authenticateToken, requireRole('super_admin'), companyController.updateCompany);

// --- Company Settings Routes ---
router.get('/settings/company', authenticateToken, settingsController.getCompanySettings);
router.put('/settings/company', authenticateToken, requireRole('admin'), settingsController.updateCompanySettings);

// --- Dashboard & Advanced Stats Routes ---
router.get('/dashboard', authenticateToken, dashboardController.getDashboardStats);
router.get('/stats/advanced', authenticateToken, statsController.getAdvancedStats);

// --- Containers Routes ---
router.get('/containers', authenticateToken, containerController.getContainers);
router.get('/containers/:id', authenticateToken, containerController.getContainerById);
router.post('/containers', authenticateToken, requireRole('admin', 'logistics'), containerController.createContainer);
router.put('/containers/:id', authenticateToken, requireRole('admin', 'logistics'), containerController.updateContainer);
router.delete('/containers/:id', authenticateToken, requireRole('admin'), containerController.deleteContainer);
router.post('/containers/:id/costs', authenticateToken, requireRole('admin', 'logistics'), containerController.addContainerCost);
router.delete('/containers/costs/:costId', authenticateToken, requireRole('admin', 'logistics'), containerController.deleteContainerCost);

// --- Excel Import / Export Routes ---
router.post('/containers/import-excel', authenticateToken, requireRole('admin', 'logistics'), upload.single('file'), excelController.importContainerExcel);
router.get('/containers/:id/export-excel', authenticateToken, excelController.exportContainerExcel);

// --- Clients Routes ---
router.get('/clients', authenticateToken, clientController.getClients);
router.get('/clients/:id', authenticateToken, clientController.getClientById);
router.post('/clients', authenticateToken, clientController.createClient);
router.put('/clients/:id', authenticateToken, clientController.updateClient);
router.delete('/clients/:id', authenticateToken, requireRole('admin'), clientController.deleteClient);

// --- Lots & Goods Routes ---
router.get('/lots', authenticateToken, lotController.getLots);
router.get('/lots/:id', authenticateToken, lotController.getLotById);
router.post('/lots', authenticateToken, requireRole('admin', 'logistics'), lotController.createLot);
router.put('/lots/:id', authenticateToken, requireRole('admin', 'logistics'), lotController.updateLot);
router.put('/lots/:id/pickup', authenticateToken, requireRole('admin', 'logistics'), lotController.updatePickupStatus);
router.delete('/lots/:id', authenticateToken, requireRole('admin'), lotController.deleteLot);

// --- Payments & PDF Receipts Routes ---
router.get('/payments', authenticateToken, requireRole('admin', 'cashier'), paymentController.getPayments);
router.post('/payments', authenticateToken, requireRole('admin', 'cashier'), paymentController.createPayment);
router.put('/payments/:id', authenticateToken, requireRole('admin'), paymentController.updatePayment);
router.delete('/payments/:id', authenticateToken, requireRole('admin'), paymentController.deletePayment);
router.get('/payments/:id/pdf', authenticateToken, paymentController.generateReceiptPDF);
router.post('/payments/verify-qr', authenticateToken, paymentController.verifyReceiptQR);

// --- WhatsApp Notifications & Baileys Routes ---
router.get('/whatsapp/status', authenticateToken, whatsappController.getWhatsAppStatus);
router.post('/whatsapp/connect', authenticateToken, requireRole('admin'), whatsappController.connectWhatsApp);
router.post('/whatsapp/disconnect', authenticateToken, requireRole('admin'), whatsappController.disconnectWhatsApp);
router.get('/whatsapp/preview/:containerId', authenticateToken, requireRole('admin', 'agent'), whatsappController.getContainerNotificationPreview);
router.post('/whatsapp/send-bulk', authenticateToken, requireRole('admin', 'agent'), whatsappController.sendBulkNotifications);
router.post('/whatsapp/send-single', authenticateToken, requireRole('admin', 'agent'), whatsappController.sendIndividualNotification);
router.get('/whatsapp/logs', authenticateToken, requireRole('admin', 'agent'), whatsappController.getWhatsAppLogs);

// --- Pricing & Warehouses Routes (Autorisés pour tous les rôles) ---
router.get('/pricing', authenticateToken, pricingController.getPricingServices);
router.post('/pricing', authenticateToken, pricingController.createPricingService);
router.put('/pricing/:id', authenticateToken, pricingController.updatePricingService);
router.delete('/pricing/:id', authenticateToken, pricingController.deletePricingService);
router.get('/warehouses', authenticateToken, pricingController.getWarehouses);
router.post('/warehouses', authenticateToken, pricingController.createWarehouse);
router.put('/warehouses/:id', authenticateToken, pricingController.updateWarehouse);
router.delete('/warehouses/:id', authenticateToken, pricingController.deleteWarehouse);

// --- Collaborateurs / Users Management Routes ---
router.get('/users', authenticateToken, requireRole('admin'), userController.getUsers);
router.post('/users', authenticateToken, requireRole('admin'), userController.createUser);
router.put('/users/:id', authenticateToken, requireRole('admin'), userController.updateUser);
router.delete('/users/:id', authenticateToken, requireRole('admin'), userController.deleteUser);

// --- Expenses & Charges Management Routes ---
router.get('/expenses', authenticateToken, expenseController.getExpenses);
router.post('/expenses', authenticateToken, requireRole('admin', 'logistics', 'cashier'), expenseController.createExpense);
router.put('/expenses/:id', authenticateToken, requireRole('admin', 'logistics', 'cashier'), expenseController.updateExpense);
router.delete('/expenses/:id', authenticateToken, requireRole('admin'), expenseController.deleteExpense);

// --- Audit Trail & Security Logs Routes ---
router.get('/audit-logs', authenticateToken, requireRole('admin'), auditController.getAuditLogs);

module.exports = router;
