import {useCallback, useEffect, useRef, useState} from 'react';

/**
 * Solid hex swatches only (same as original PDP dropdown — no product photos in the chip).
 *
 * @param {{
 *   code: string;
 *   formattedCode?: string | null;
 *   imageUrl?: string | null;
 *   image?: { url?: string } | null;
 * }} color
 */
function colorSwatchStyle(color) {
  const fc = color.formattedCode?.trim();
  if (fc) {
    return {backgroundColor: fc.startsWith('#') ? fc : `#${fc}`};
  }
  const raw = String(color.code || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw) || /^[0-9a-f]{6}$/i.test(raw) || /^[0-9a-f]{8}$/i.test(raw)) {
    return {backgroundColor: `#${raw}`};
  }
  return {backgroundColor: '#e4e4e7'};
}

/**
 * Searchable color dropdown (matches PDP `ProductColorSwatches` control).
 *
 * @param {{
 *   colors: Array<{
 *     code: string;
 *     name: string;
 *     formattedCode?: string | null;
 *     product?: unknown;
 *     image?: { url?: string; altText?: string } | null;
 *     imageUrl?: string | null;
 *   }>;
 *   selectedColor: string | null;
 *   onColorSelect: (code: string, product?: unknown, image?: unknown) => void;
 *   triggerId?: string;
 * }} props
 */
export function ColorDropdown({
  colors,
  selectedColor,
  onColorSelect,
  triggerId = 'color-dropdown',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const selectedColorObj = colors.find((c) => c.code === selectedColor);
  const displayName = selectedColorObj?.name || 'Select a color';

  const filteredColors = colors.filter((color) =>
    color.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleColorSelect = useCallback(
    (color) => {
      onColorSelect(color.code, color.product, color.image);
      setIsOpen(false);
      setSearchTerm('');
    },
    [onColorSelect],
  );

  return (
    <div className="color-dropdown-container" ref={dropdownRef}>
      <button
        id={triggerId}
        type="button"
        className="color-dropdown-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="color-dropdown-selected">
          {selectedColorObj ? (
            <span
              className="color-dropdown-swatch"
              style={colorSwatchStyle(selectedColorObj)}
            />
          ) : null}
          <span className="color-dropdown-text">{displayName}</span>
        </div>
        <svg
          className={`color-dropdown-arrow ${isOpen ? 'open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {isOpen ? (
        <div className="color-dropdown-menu">
          <div className="color-dropdown-search">
            <input
              type="text"
              placeholder="Search colors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="color-dropdown-search-input"
              autoFocus
            />
          </div>
          <div className="color-dropdown-options">
            {filteredColors.length === 0 ? (
              <div className="color-dropdown-no-results">No colors found</div>
            ) : (
              filteredColors.map((color) => (
                <button
                  key={color.code}
                  type="button"
                  className={`color-dropdown-option ${selectedColor === color.code ? 'selected' : ''}`}
                  onClick={() => handleColorSelect(color)}
                >
                  <span
                    className="color-dropdown-option-swatch"
                    style={colorSwatchStyle(color)}
                  />
                  <span className="color-dropdown-option-name">{color.name}</span>
                  {selectedColor === color.code ? (
                    <svg
                      className="color-dropdown-check"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M13 3L6 10l-3-3" />
                    </svg>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
