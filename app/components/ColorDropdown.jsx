import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {createPortal} from 'react-dom';

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
  const raw = String(color.code || '')
    .trim()
    .replace(/^#/, '');
  if (
    /^[0-9a-f]{3}$/i.test(raw) ||
    /^[0-9a-f]{6}$/i.test(raw) ||
    /^[0-9a-f]{8}$/i.test(raw)
  ) {
    return {backgroundColor: `#${raw}`};
  }
  return {backgroundColor: '#e4e4e7'};
}

/**
 * Searchable color dropdown (matches PDP `ProductColorSwatches` control).
 * Menu is portaled + fixed so it never reflows parent layouts (e.g. Design Studio).
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
  const [menuStyle, setMenuStyle] = useState(
    /** @type {Record<string, string | number> | null} */ (null),
  );
  const dropdownRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const buttonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const menuRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const searchInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  const selectedColorObj = colors.find((c) => c.code === selectedColor);
  const displayName = selectedColorObj?.name || 'Select a color';

  const filteredColors = colors.filter((color) =>
    color.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const gutter = 8;
    const spaceBelow = window.innerHeight - rect.bottom - gutter;
    const spaceAbove = rect.top - gutter;
    const preferBelow = spaceBelow >= 200 || spaceBelow >= spaceAbove;
    const available = Math.max(160, preferBelow ? spaceBelow : spaceAbove);
    const menuMaxHeight = Math.min(340, available);
    const top = preferBelow
      ? rect.bottom + gutter
      : Math.max(gutter, rect.top - gutter - menuMaxHeight);

    setMenuStyle({
      position: 'fixed',
      top,
      left: rect.left,
      width: rect.width,
      maxHeight: menuMaxHeight,
      zIndex: 5000,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return;
    }

    updateMenuPosition();

    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    // Capture scroll from nested containers (Design Studio panes, etc.)
    window.addEventListener('scroll', onReposition, true);

    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;

    // Focus search without scrolling parent panes / jumping the garment preview
    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus({preventScroll: true});
    });

    function handleClickOutside(event) {
      const target = /** @type {Node} */ (event.target);
      if (dropdownRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
      setSearchTerm('');
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
        buttonRef.current?.focus({preventScroll: true});
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleColorSelect = useCallback(
    (color) => {
      onColorSelect(color.code, color.product, color.image);
      setIsOpen(false);
      setSearchTerm('');
    },
    [onColorSelect],
  );

  const menu =
    isOpen && menuStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="color-dropdown-menu color-dropdown-menu--portal"
            style={menuStyle}
            role="listbox"
            aria-labelledby={triggerId}
          >
            <div className="color-dropdown-search">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search colors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="color-dropdown-search-input"
                aria-label="Search colors"
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
                    role="option"
                    aria-selected={selectedColor === color.code}
                    className={`color-dropdown-option ${
                      selectedColor === color.code ? 'selected' : ''
                    }`}
                    onClick={() => handleColorSelect(color)}
                  >
                    <span
                      className="color-dropdown-option-swatch"
                      style={colorSwatchStyle(color)}
                    />
                    <span className="color-dropdown-option-name">
                      {color.name}
                    </span>
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="color-dropdown-container" ref={dropdownRef}>
      <button
        ref={buttonRef}
        id={triggerId}
        type="button"
        className="color-dropdown-button"
        onClick={() => setIsOpen((open) => !open)}
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
      {menu}
    </div>
  );
}
