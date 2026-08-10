import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string | number;
  onChange: (val: string | number) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Sélectionner...',
  searchPlaceholder = 'Rechercher par nom ou numéro...',
  emptyMessage = 'Aucun résultat trouvé.',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => String(o.value) === String(value));

  // Fermer le dropdown lors d'un clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ouvrir le dropdown et donner le focus au champ de recherche
  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const filteredOptions = options.filter(option => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const labelMatch = option.label.toLowerCase().includes(term);
    const sublabelMatch = option.sublabel ? option.sublabel.toLowerCase().includes(term) : false;
    return labelMatch || sublabelMatch;
  });

  const handleSelect = (val: string | number) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Bouton du Sélecteur */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={`w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold text-left flex items-center justify-between gap-2 text-xs transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'
        }`}
      >
        <span className="truncate text-foreground">
          {selectedOption ? (
            <span className="flex items-center gap-2">
              <span className="font-extrabold">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-muted-foreground font-normal">({selectedOption.sublabel})</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground font-normal">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Menu Déroulant Filtrable en Temps Réel */}
      {isOpen && (
        <div className="absolute z-[10000] left-0 right-0 mt-1 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95">
          {/* Champ de recherche en temps réel */}
          <div className="p-2.5 border-b border-border bg-secondary/40 sticky top-0 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground font-bold focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-1 rounded-md hover:bg-secondary text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Liste des options filtrées */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 divide-y divide-border/30">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = String(option.value) === String(value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-extrabold'
                        : 'hover:bg-secondary/80 text-foreground font-medium'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-extrabold truncate">{option.label}</span>
                      {option.sublabel && (
                        <span className={`text-[11px] truncate ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {option.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground font-medium">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
