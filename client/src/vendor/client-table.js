/**
 * Client-Side Table Component
 * Provides filtering, sorting, pagination without page reloads
 * 
 * Usage:
 *   const table = new ClientTable('tableId', data, options);
 */

class ClientTable {
    constructor(tableId, data, options = {}) {
        this.tableId = tableId;
        this.originalData = data;
        this.currentData = [...data];
        
        // Configuration
        this.config = {
            rowsPerPage: options.rowsPerPage || 10,
            rowsOptions: options.rowsOptions || [5, 10, 25, 50, 100],
            enableSearch: options.enableSearch !== false,
            enableSort: options.enableSort !== false,
            enablePagination: options.enablePagination !== false,
            enableRowSelector: options.enableRowSelector !== false,
            enableDragDrop: options.enableDragDrop || false,
            columns: options.columns || [],
            searchPlaceholder: options.searchPlaceholder || 'Zoeken...',
            noDataMessage: options.noDataMessage || 'Geen data beschikbaar',
            deleteConfirmTitle: options.deleteConfirmTitle || 'Verwijderen bevestigen',
            deleteConfirmMessage: options.deleteConfirmMessage || 'Weet u zeker dat u dit item wilt verwijderen?',
            deleteConfirmButton: options.deleteConfirmButton || 'Verwijderen',
            deleteCancelButton: options.deleteCancelButton || 'Annuleren',
            onDeleteConfirm: options.onDeleteConfirm || null,
            onRowReorder: options.onRowReorder || null,
            ...options
        };
        
        // State
        this.currentPage = 1;
        this.rowsPerPage = this.config.rowsPerPage;
        this.searchQuery = '';
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.columnFilters = {}; // Store active filters per column
        
        // Initialize
        this.init();
    }
    
    init() {
        console.log(`[ClientTable] Initializing table ${this.tableId}`);
        this.createDeleteModal();
        this.render();
        this.attachEventListeners();
        if (this.config.enableDragDrop) {
            this.initializeDragDrop();
        }
        console.log(`[ClientTable] Table ${this.tableId} initialization complete`);
    }

    parseDateValue(value) {
        if (value instanceof Date) return value;
        if (typeof value === 'string') {
            const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (dateOnlyMatch) {
                const [, year, month, day] = dateOnlyMatch;
                return new Date(Number(year), Number(month) - 1, Number(day));
            }

            const dateTimeMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
            if (dateTimeMatch) {
                const [, year, month, day, hour, minute, second] = dateTimeMatch;
                return new Date(
                    Number(year),
                    Number(month) - 1,
                    Number(day),
                    Number(hour),
                    Number(minute),
                    Number(second || 0)
                );
            }
        }

        return new Date(value);
    }
    
    attachEventListeners() {
        // Search
        if (this.config.enableSearch) {
            const searchInput = document.querySelector(`#${this.tableId}-search`);
            if (searchInput) {
                searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            }
        }
        
        // Column filters
        this.attachColumnFilterListeners();
        
        // Rows selector
        if (this.config.enableRowSelector) {
            const rowsDropdown = document.querySelector(`#${this.tableId}-rows-dropdown`);
            if (rowsDropdown) {
                rowsDropdown.addEventListener('click', () => this.toggleRowsDropdown());
            }
            
            // Close dropdown on outside click
            document.addEventListener('click', (e) => {
                const dropdown = document.querySelector(`#${this.tableId}-rows-dropdown`);
                const options = document.querySelector(`#${this.tableId}-rows-options`);
                if (dropdown && options && !e.target.closest(`#${this.tableId}-rows-wrapper`)) {
                    options.style.display = 'none';
                }
            });
        }
    }
    
    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        this.currentPage = 1;
        this.filterAndSort();
        this.render();
    }
    
    attachColumnFilterListeners() {
        // Attach listeners to all column filter dropdowns
        const filterToggles = document.querySelectorAll(`#${this.tableId} thead .filter-toggle`);
        
        console.log(`[ClientTable] Found ${filterToggles.length} filter toggles for table ${this.tableId}`);
        
        filterToggles.forEach(toggle => {
            const columnKey = toggle.dataset.column;
            
            // Toggle dropdown visibility
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log(`[ClientTable] Filter toggle clicked for column: ${columnKey}`);
                
                // Find the dropdown - it's the next sibling of the button
                const dropdown = toggle.nextElementSibling;
                
                if (!dropdown || !dropdown.classList.contains('filter-dropdown')) {
                    console.error(`[ClientTable] Dropdown not found for column ${columnKey}`);
                    return;
                }
                
                const isVisible = dropdown.style.display === 'block';
                
                // Close all other dropdowns
                document.querySelectorAll(`#${this.tableId} thead .filter-dropdown`).forEach(dd => {
                    dd.style.display = 'none';
                });
                
                if (!isVisible) {
                    // Position dropdown using fixed positioning
                    const rect = toggle.getBoundingClientRect();
                    const dropdownWidth = 280;
                    dropdown.style.top = `${rect.bottom + 2}px`;
                    const leftPosition = rect.right - dropdownWidth;
                    dropdown.style.left = `${Math.max(8, leftPosition)}px`;
                    
                    // Toggle current dropdown
                    dropdown.style.display = 'block';
                    
                    console.log(`[ClientTable] Dropdown opened for column ${columnKey}`);
                    
                    // Populate dropdown if empty
                    if (dropdown.dataset.populated !== 'true' || dropdown.children.length === 0) {
                        console.log(`[ClientTable] Populating dropdown for column ${columnKey}`);
                        this.populateColumnFilterDropdown(columnKey, dropdown);
                    }
                    
                    // Prevent clicks inside dropdown from closing it
                    dropdown.addEventListener('click', (dropdownEvent) => {
                        dropdownEvent.stopPropagation();
                    });
                } else {
                    console.log(`[ClientTable] Dropdown closed for column ${columnKey}`);
                }
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-toggle') && !e.target.closest('.filter-dropdown')) {
                const dropdowns = document.querySelectorAll(`#${this.tableId} thead .filter-dropdown`);
                dropdowns.forEach(dd => {
                    if (dd.style.display === 'block') {
                        console.log('[ClientTable] Closing dropdown due to outside click');
                        dd.style.display = 'none';
                    }
                });
            }
        });
    }
    
    populateColumnFilterDropdown(columnKey, dropdown) {
        // Get unique values for this column with proper normalization
        const uniqueValuesMap = new Map(); // Use Map to track both raw and normalized values
        const column = this.config.columns.find(col => col.key === columnKey);
        
        this.originalData.forEach(item => {
            let value = item[columnKey];
            if (value === null || value === undefined || value === '') {
                return;
            }
            
            // Normalize value based on column type to ensure uniqueness
            let normalizedKey = value;
            if (column && column.type === 'boolean') {
                // Normalize boolean values to consistent format
                normalizedKey = (value === 1 || value === true || value === '1' || String(value).toLowerCase() === 'true') ? '1' : '0';
            } else if (column && (column.type === 'date' || column.type === 'datetime')) {
                // Normalize dates/datetimes to date-only string (ignore time) for comparison
                try {
                    const date = this.parseDateValue(value);
                    // Use YYYY-MM-DD format to ignore time component
                    normalizedKey = date.getFullYear() + '-' + 
                                   String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                                   String(date.getDate()).padStart(2, '0');
                } catch (e) {
                    normalizedKey = String(value);
                }
            } else if (column && column.type === 'currency') {
                // Normalize currency to number
                normalizedKey = parseFloat(value) || 0;
            } else {
                // For text and other types, convert to string and trim
                normalizedKey = String(value).trim();
            }
            
            // Use normalized key to prevent duplicates
            if (!uniqueValuesMap.has(normalizedKey)) {
                uniqueValuesMap.set(normalizedKey, value);
            }
        });
        
        // Sort unique values
        const sortedValues = Array.from(uniqueValuesMap.values()).sort((a, b) => {
            if (typeof a === 'number' && typeof b === 'number') return a - b;
            if (column && (column.type === 'date' || column.type === 'datetime')) {
                return this.parseDateValue(a) - this.parseDateValue(b);
            }
            return String(a).localeCompare(String(b));
        });
        
        console.log(`[ClientTable] Found ${sortedValues.length} unique values for column ${columnKey}:`, sortedValues);
        
        // Build filter options HTML
        let html = '<div class="filter-search-wrapper">';
        html += `<input type="text" class="filter-search" placeholder="Zoek en filter..." />`;
        html += `<button class="filter-search-apply" onclick="window.${this.tableId}_instance.applySearchFilter('${columnKey}')" title="Pas zoekopdracht toe als filter">
                    <i class="fas fa-check"></i>
                </button>`;
        html += '</div>';
        html += '<div class="filter-options">';
        
        // Select All / Deselect All
        html += '<div class="filter-actions">';
        html += `<button class="filter-action-btn" onclick="window.${this.tableId}_instance.selectAllFilters('${columnKey}')">Alles selecteren</button>`;
        html += `<button class="filter-action-btn" onclick="window.${this.tableId}_instance.deselectAllFilters('${columnKey}')">Alles deselecteren</button>`;
        html += '</div>';
        
        // Individual options
        sortedValues.forEach(value => {
            const isChecked = !this.columnFilters[columnKey] || this.columnFilters[columnKey].includes(value);
            const displayValue = this.formatFilterValue(value, columnKey);
            html += `
                <label class="filter-option">
                    <input type="checkbox" 
                           value="${this.escapeHtml(String(value))}" 
                           ${isChecked ? 'checked' : ''}
                           onchange="window.${this.tableId}_instance.handleColumnFilter('${columnKey}', this.value, this.checked)" />
                    <span>${displayValue}</span>
                </label>
            `;
        });
        
        html += '</div>';
        dropdown.innerHTML = html;
        dropdown.dataset.populated = 'true';
        
        // Attach filter search listener
        const filterSearch = dropdown.querySelector('.filter-search');
        if (filterSearch) {
            filterSearch.addEventListener('input', (e) => {
                this.filterDropdownOptions(dropdown, e.target.value);
            });
        }
    }
    
    formatFilterValue(value, columnKey) {
        // Find column config
        const column = this.config.columns.find(col => col.key === columnKey);
        
        if (!column) return value;
        
        // Format based on type
        if (column.type === 'boolean') {
            const isActive = value === 1 || value === true || value === '1' || String(value).toLowerCase() === 'true';
            return isActive ? 'Actief' : 'Inactief';
        } else if (column.type === 'datetime') {
            // For filter dropdown, show only date (not time)
            return this.parseDateValue(value).toLocaleDateString('nl-NL');
        } else if (column.type === 'date') {
            return this.parseDateValue(value).toLocaleDateString('nl-NL');
        } else if (column.type === 'currency') {
            return '€ ' + parseFloat(value).toLocaleString('nl-NL', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        
        return value;
    }
    
    filterDropdownOptions(dropdown, searchQuery) {
        const query = searchQuery.toLowerCase();
        const options = dropdown.querySelectorAll('.filter-option');
        
        let visibleCount = 0;
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            const isVisible = text.includes(query);
            option.style.display = isVisible ? '' : 'none';
            if (isVisible) visibleCount++;
        });
        
        // Show/hide apply button based on search
        const applyBtn = dropdown.querySelector('.filter-search-apply');
        if (applyBtn) {
            applyBtn.style.display = query.length > 0 && visibleCount > 0 ? 'flex' : 'none';
        }
    }
    
    applySearchFilter(columnKey) {
        const filterToggle = document.querySelector(`#${this.tableId} thead .filter-toggle[data-column="${columnKey}"]`);
        if (!filterToggle) return;
        
        const dropdown = filterToggle.nextElementSibling;
        if (!dropdown) return;
        
        const searchInput = dropdown.querySelector('.filter-search');
        const query = searchInput ? searchInput.value.toLowerCase() : '';
        
        if (!query) return;
        
        // Deselect all first
        this.columnFilters[columnKey] = [];
        
        // Select only visible (matching) items
        const visibleOptions = dropdown.querySelectorAll('.filter-option:not([style*="display: none"])');
        visibleOptions.forEach(option => {
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox) {
                const value = checkbox.value;
                // Convert to proper type
                const column = this.config.columns.find(col => col.key === columnKey);
                let typedValue = value;
                
                if (column) {
                    if (column.type === 'boolean') {
                        typedValue = value === 'true' || value === '1' || value === 1;
                    } else if (!isNaN(value) && value !== '') {
                        typedValue = parseFloat(value);
                    }
                }
                
                this.columnFilters[columnKey].push(typedValue);
                checkbox.checked = true;
            }
        });
        
        // Deselect hidden items
        const hiddenOptions = dropdown.querySelectorAll('.filter-option[style*="display: none"]');
        hiddenOptions.forEach(option => {
            const checkbox = option.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = false;
            }
        });
        
        console.log(`[ClientTable] Applied search filter for column ${columnKey}:`, this.columnFilters[columnKey]);
        
        // Update filter indicator
        this.updateFilterIndicator(columnKey);
        
        // Re-filter and render
        this.currentPage = 1;
        this.filterAndSort();
        this.render();
        
        // Clear search and close dropdown
        searchInput.value = '';
        this.filterDropdownOptions(dropdown, '');
    }
    
    handleColumnFilter(columnKey, value, isChecked) {
        // Initialize filter array for this column if not exists
        if (!this.columnFilters[columnKey]) {
            // Get all unique values initially (all selected)
            const uniqueValues = new Set();
            this.originalData.forEach(item => {
                const val = item[columnKey];
                if (val !== null && val !== undefined && val !== '') {
                    uniqueValues.add(val);
                }
            });
            this.columnFilters[columnKey] = Array.from(uniqueValues);
        }
        
        // Convert value to appropriate type
        const column = this.config.columns.find(col => col.key === columnKey);
        let typedValue = value;
        
        if (column) {
            if (column.type === 'boolean') {
                typedValue = value === 'true' || value === '1' || value === 1;
            } else if (!isNaN(value) && value !== '') {
                typedValue = parseFloat(value);
            }
        }
        
        // Update filter array
        if (isChecked) {
            if (!this.columnFilters[columnKey].includes(typedValue)) {
                this.columnFilters[columnKey].push(typedValue);
            }
        } else {
            this.columnFilters[columnKey] = this.columnFilters[columnKey].filter(v => v != typedValue);
        }
        
        // Update filter indicator
        this.updateFilterIndicator(columnKey);
        
        // Re-filter and render
        this.currentPage = 1;
        this.filterAndSort();
        this.render();
    }
    
    selectAllFilters(columnKey) {
        const uniqueValues = new Set();
        this.originalData.forEach(item => {
            const value = item[columnKey];
            if (value !== null && value !== undefined && value !== '') {
                uniqueValues.add(value);
            }
        });
        
        this.columnFilters[columnKey] = Array.from(uniqueValues);
        
        // Update all checkboxes
        const filterToggle = document.querySelector(`#${this.tableId} thead .filter-toggle[data-column="${columnKey}"]`);
        if (filterToggle) {
            const dropdown = filterToggle.nextElementSibling;
            dropdown.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = true;
            });
        }
        
        // Update filter indicator
        this.updateFilterIndicator(columnKey);
        
        // Re-filter and render
        this.currentPage = 1;
        this.filterAndSort();
        this.render();
    }
    
    deselectAllFilters(columnKey) {
        this.columnFilters[columnKey] = [];
        
        // Update all checkboxes
        const filterToggle = document.querySelector(`#${this.tableId} thead .filter-toggle[data-column="${columnKey}"]`);
        if (filterToggle) {
            const dropdown = filterToggle.nextElementSibling;
            dropdown.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        
        // Update filter indicator
        this.updateFilterIndicator(columnKey);
        
        // Re-filter and render
        this.currentPage = 1;
        this.filterAndSort();
        this.render();
    }
    
    updateFilterIndicator(columnKey) {
        const filterToggle = document.querySelector(`#${this.tableId} thead .filter-toggle[data-column="${columnKey}"]`);
        if (!filterToggle) return;
        
        // Get total unique values
        const uniqueValues = new Set();
        this.originalData.forEach(item => {
            const value = item[columnKey];
            if (value !== null && value !== undefined && value !== '') {
                uniqueValues.add(value);
            }
        });
        
        const totalCount = uniqueValues.size;
        const selectedCount = this.columnFilters[columnKey] ? this.columnFilters[columnKey].length : totalCount;
        
        // Update icon and indicator
        const icon = filterToggle.querySelector('i');
        if (selectedCount < totalCount && selectedCount > 0) {
            icon.className = 'fas fa-filter active';
            filterToggle.title = `Filter: ${selectedCount}/${totalCount} geselecteerd`;
        } else if (selectedCount === 0) {
            icon.className = 'fas fa-filter active-empty';
            filterToggle.title = 'Filter: Geen items geselecteerd';
        } else {
            icon.className = 'fas fa-filter';
            filterToggle.title = 'Filter kolom';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    
    handleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        this.filterAndSort();
        this.render();
    }
    
    handleRowsChange(rows) {
        if (rows === 'alle') {
            this.rowsPerPage = this.currentData.length || 999999;
        } else {
            this.rowsPerPage = parseInt(rows);
        }
        this.currentPage = 1;
        
        // Update dropdown display
        const selectedValue = document.querySelector(`#${this.tableId}-rows-selected`);
        if (selectedValue) {
            selectedValue.textContent = rows === 'alle' ? 'Alle' : rows;
        }
        
        // Update active state
        document.querySelectorAll(`#${this.tableId}-rows-options .custom-option`).forEach(opt => {
            opt.classList.remove('active');
            if (opt.dataset.value == rows) {
                opt.classList.add('active');
            }
        });
        
        // Close dropdown
        const options = document.querySelector(`#${this.tableId}-rows-options`);
        if (options) options.style.display = 'none';
        
        this.render();
    }
    
    toggleRowsDropdown() {
        const options = document.querySelector(`#${this.tableId}-rows-options`);
        if (options) {
            options.style.display = options.style.display === 'block' ? 'none' : 'block';
        }
    }
    
    filterAndSort() {
        // Filter
        let filtered = this.originalData;
        
        // Apply global search filter
        if (this.searchQuery) {
            filtered = filtered.filter(item => {
                return this.config.columns.some(col => {
                    const value = String(item[col.key] || '').toLowerCase();
                    return value.includes(this.searchQuery);
                });
            });
        }
        
        // Apply column-specific filters
        Object.keys(this.columnFilters).forEach(columnKey => {
            const allowedValues = this.columnFilters[columnKey];
            if (allowedValues && allowedValues.length > 0) {
                filtered = filtered.filter(item => {
                    const itemValue = item[columnKey];
                    // Check if item value is in allowed values
                    return allowedValues.some(allowedValue => allowedValue == itemValue);
                });
            } else if (allowedValues && allowedValues.length === 0) {
                // If no values selected, show nothing
                filtered = [];
            }
        });
        
        // Sort
        if (this.sortColumn) {
            filtered = [...filtered].sort((a, b) => {
                const aVal = a[this.sortColumn];
                const bVal = b[this.sortColumn];
                
                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                }
                
                const aStr = String(aVal).toLowerCase();
                const bStr = String(bVal).toLowerCase();
                
                if (this.sortDirection === 'asc') {
                    return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
                } else {
                    return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
                }
            });
        }
        
        this.currentData = filtered;
    }
    
    render() {
        this.renderTable();
        if (this.config.enablePagination) {
            this.renderPagination();
        }
        this.updateSortIndicators();
    }
    
    renderTable() {
        const tbody = document.querySelector(`#${this.tableId} tbody`);
        if (!tbody) return;
        
        const start = (this.currentPage - 1) * this.rowsPerPage;
        const end = start + this.rowsPerPage;
        const pageData = this.currentData.slice(start, end);
        
        // Clear tbody
        tbody.innerHTML = '';
        
        if (pageData.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = this.config.columns.length + (this.config.actions ? 1 : 0);
            td.textContent = this.config.noDataMessage;
            td.style.textAlign = 'center';
            td.style.padding = '2rem';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }
        
        pageData.forEach((item, index) => {
            const tr = document.createElement('tr');
            // Store data index for drag & drop reordering
            tr.dataset.itemIndex = start + index;
            tr.dataset.itemId = item.id || (start + index);
            
            this.config.columns.forEach(column => {
                const td = document.createElement('td');
                
                // Apply width if specified
                if (column.width) {
                    td.style.width = column.width;
                    td.style.maxWidth = column.width;
                }
                
                let value = item[column.key];
                
                // Format based on type
                if (column.type === 'currency') {
                    value = '€ ' + parseFloat(value).toLocaleString('nl-NL', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                } else if (column.type === 'datetime') {
                    // DateTime: show both date and time
                    const dateObj = this.parseDateValue(value);
                    const datePart = dateObj.toLocaleDateString('nl-NL');
                    const timePart = dateObj.toLocaleTimeString('nl-NL', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    value = `${datePart} ${timePart}`;
                } else if (column.type === 'date') {
                    value = this.parseDateValue(value).toLocaleDateString('nl-NL');
                } else if (column.type === 'boolean') {
                    // Convert boolean/number to Actief/Inactief
                    const isActive = value === 1 || value === true || value === '1' || String(value).toLowerCase() === 'true';
                    value = isActive ? 'Actief' : 'Inactief';
                    td.className = isActive ? 'text-success' : 'text-muted';
                } else if (column.type === 'status_preview') {
                    // Create status preview badge with custom colors
                    const bgColor = item.AchtergrondKleur || '#007bff';
                    const textColor = item.TekstKleur || '#ffffff';
                    const name = item.Naam || 'Status';
                    td.innerHTML = `<span class="status-badge" style="background-color: ${bgColor}; color: ${textColor}; padding: 4px 12px; border-radius: 4px; font-weight: 500;">${name}</span>`;
                    tr.appendChild(td);
                    return;
                } else if (column.type === 'status') {
                    const statusClass = String(value).toLowerCase().replace(/ /g, '-');
                    td.innerHTML = `<span class="status-badge status-${statusClass}">${value}</span>`;
                    tr.appendChild(td);
                    return;
                } else if (column.render) {
                    // Custom render function
                    value = column.render(value, item);
                }
                
                td.textContent = value;
                tr.appendChild(td);
            });
            
            // Actions column
            if (this.config.actions) {
                const actionTd = document.createElement('td');
                actionTd.className = 'actions-column';
                const itemId = item.Id || item.id || 0;
                
                // Filter out drag action (handled by enableDragDrop)
                const visibleActions = this.config.actions.filter(action => action.type !== 'drag');
                
                // Create action buttons container
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'table-actions';
                
                visibleActions.forEach(action => {
                    const btn = document.createElement('button');
                    btn.className = `table-action-btn ${action.type} icon-only`;
                    btn.title = action.label || action.title || action.type;
                    
                    const icon = document.createElement('i');
                    icon.className = `fas fa-${action.icon || this.getDefaultIcon(action.type)}`;
                    btn.appendChild(icon);
                    
                    // Add click event listener
                    if (action.onClick) {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const handlerName = action.onClick;
                            
                            // Call the global function with id and row data
                            if (handlerName && typeof window[handlerName] === 'function') {
                                try {
                                    window[handlerName](itemId, item);
                                } catch (err) {
                                    console.error(`Error calling ${handlerName}:`, err);
                                }
                            } else {
                                console.warn(`Handler function "${handlerName}" not found on window object`);
                            }
                        });
                    }
                    
                    actionsDiv.appendChild(btn);
                });
                
                actionTd.appendChild(actionsDiv);
                tr.appendChild(actionTd);
            }
            
            tbody.appendChild(tr);
        });
        // Re-apply drag and drop if enabled
        if (this.config.enableDragDrop && this._makeRowDraggable) {
            tbody.querySelectorAll('tr').forEach(this._makeRowDraggable);
        }
    }
    
    renderPagination() {
        const container = document.querySelector(`#${this.tableId}-pagination`);
        if (!container) return;
        
        const totalPages = Math.ceil(this.currentData.length / this.rowsPerPage);
        const start = (this.currentPage - 1) * this.rowsPerPage + 1;
        const end = Math.min(start + this.rowsPerPage - 1, this.currentData.length);
        
        if (totalPages <= 1) {
            // Toon alleen info, geen pagination controls
            container.innerHTML = `<div class="table-footer">
                <div class="table-info">Totaal ${this.currentData.length} ${this.currentData.length === 1 ? 'rij' : 'rijen'}</div>
            </div>`;
            return;
        }
        
        let html = '<div class="table-footer">';
        html += `<div class="table-info">Rij ${start} - ${end} van ${this.currentData.length}</div>`;
        html += '<div class="pagination-controls">';
        
        // Previous button
        html += `<button class="pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
                         onclick="window.${this.tableId}_instance.changePage(${this.currentPage - 1})"
                         ${this.currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                 </button>`;
        
        // Page numbers
        const maxButtons = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        
        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }
        
        if (startPage > 1) {
            html += `<button class="pagination-btn" onclick="window.${this.tableId}_instance.changePage(1)">1</button>`;
            if (startPage > 2) html += '<span class="pagination-ellipsis">...</span>';
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}"
                             onclick="window.${this.tableId}_instance.changePage(${i})">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += '<span class="pagination-ellipsis">...</span>';
            html += `<button class="pagination-btn" onclick="window.${this.tableId}_instance.changePage(${totalPages})">${totalPages}</button>`;
        }
        
        // Next button
        html += `<button class="pagination-btn ${this.currentPage === totalPages ? 'disabled' : ''}"
                         onclick="window.${this.tableId}_instance.changePage(${this.currentPage + 1})"
                         ${this.currentPage === totalPages ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                 </button>`;
        
        html += '</div>'; // Close pagination-controls
        html += '</div>'; // Close table-footer
        container.innerHTML = html;
    }
    
    updateSortIndicators() {
        // Update sort icons on headers
        document.querySelectorAll(`#${this.tableId} thead th.sortable`).forEach(th => {
            const column = th.dataset.column;
            const icon = th.querySelector('.sort-icon i');
            
            if (icon) {
                icon.className = ''; // Clear classes
                if (column === this.sortColumn) {
                    icon.className = this.sortDirection === 'asc' ? 'fas fa-sort-up active' : 'fas fa-sort-down active';
                } else {
                    icon.className = 'fas fa-sort';
                }
            }
        });
    }
    
    changePage(page) {
        const totalPages = Math.ceil(this.currentData.length / this.rowsPerPage);
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.render();
    }
    
    getDefaultIcon(type) {
        const icons = {
            'edit': 'edit',
            'delete': 'trash',
            'view': 'eye',
            'download': 'download'
        };
        return icons[type] || 'cog';
    }
    
    // Delete confirmation modal
    createDeleteModal() {
        // Check if modal already exists
        if (document.getElementById(`${this.tableId}-delete-modal`)) {
            return;
        }
        
        const modal = document.createElement('div');
        modal.id = `${this.tableId}-delete-modal`;
        modal.className = 'client-table-modal';
        modal.innerHTML = `
            <div class="client-table-modal-overlay"></div>
            <div class="client-table-modal-content">
                <div class="client-table-modal-header">
                    <h3 class="client-table-modal-title">${this.config.deleteConfirmTitle}</h3>
                    <button class="client-table-modal-close" onclick="window.${this.tableId}_instance.closeDeleteModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="client-table-modal-body">
                    <div class="client-table-modal-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <p class="client-table-modal-message">${this.config.deleteConfirmMessage}</p>
                </div>
                <div class="client-table-modal-footer">
                    <button class="client-table-btn client-table-btn-secondary" onclick="window.${this.tableId}_instance.closeDeleteModal()">
                        ${this.config.deleteCancelButton}
                    </button>
                    <button class="client-table-btn client-table-btn-danger" onclick="window.${this.tableId}_instance.confirmDelete()">
                        <i class="fas fa-trash"></i> ${this.config.deleteConfirmButton}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close on overlay click
        modal.querySelector('.client-table-modal-overlay').addEventListener('click', () => {
            this.closeDeleteModal();
        });
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.closeDeleteModal();
            }
        });
    }
    
    showDeleteModal(itemId, callback) {
        this.pendingDeleteId = itemId;
        this.pendingDeleteCallback = callback;
        
        const modal = document.getElementById(`${this.tableId}-delete-modal`);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }
    
    closeDeleteModal() {
        const modal = document.getElementById(`${this.tableId}-delete-modal`);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        this.pendingDeleteId = null;
        this.pendingDeleteCallback = null;
    }
    
    confirmDelete() {
        if (this.pendingDeleteCallback) {
            this.pendingDeleteCallback(this.pendingDeleteId);
        } else if (this.config.onDeleteConfirm) {
            this.config.onDeleteConfirm(this.pendingDeleteId);
        }
        this.closeDeleteModal();
    }
    
    // Drag and Drop functionality
        initializeDragDrop() {
            const tbody = document.querySelector(`#${this.tableId} tbody`);
            if (!tbody) return;
            
            let draggedRow = null;
            let placeholder = null;
            let lastDropTarget = null;
            let rafId = null;

            tbody.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            tbody.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedRow && placeholder && placeholder.parentNode) {
                    placeholder.parentNode.insertBefore(draggedRow, placeholder);
                    placeholder.remove();
                }
            });
        
        // Make rows draggable
        const makeRowDraggable = (row) => {
            row.setAttribute('draggable', 'true');
            row.classList.add('draggable-row');
            
                row.addEventListener('dragstart', (e) => {
                    draggedRow = row;
                    row.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', '');
                    // Hide the default drag image to avoid ghost text floating above the table.
                    const dragCanvas = document.createElement('canvas');
                    dragCanvas.width = 1;
                    dragCanvas.height = 1;
                    e.dataTransfer.setDragImage(dragCanvas, 0, 0);
                
                // Create placeholder
                placeholder = document.createElement('tr');
                placeholder.className = 'drag-placeholder';
                placeholder.innerHTML = `<td colspan="${row.cells.length}">Zet hier neer</td>`;
            });
            
                row.addEventListener('dragend', () => {
                    row.classList.remove('dragging');
                    if (rafId) {
                        cancelAnimationFrame(rafId);
                        rafId = null;
                    }
                    if (draggedRow && placeholder && placeholder.parentNode) {
                        placeholder.parentNode.insertBefore(draggedRow, placeholder);
                        placeholder.remove();
                    } else if (placeholder && placeholder.parentNode) {
                        placeholder.remove();
                    }
                    lastDropTarget = null;
                
                // Update data order
                this.updateDataOrderFromDOM();
                
                // Dispatch event with new order for external handling
                const newOrder = this.currentData.map(item => item.Id || item.id);
                console.log('[ClientTable] Dispatching sortable update event with order:', newOrder);
                
                window.dispatchEvent(new CustomEvent('clientTableSortableUpdate', {
                    detail: {
                        tableId: this.tableId,
                        order: newOrder
                    }
                }));
                
                // Callback for custom handling
                if (this.config.onRowReorder) {
                    this.config.onRowReorder(this.currentData);
                }
            });
            
                row.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    
                    if (draggedRow && row !== draggedRow) {
                        const rect = row.getBoundingClientRect();
                        const insertAfter = e.clientY > rect.top + rect.height / 2;
                        const targetKey = `${row.dataset.itemId || ''}-${insertAfter ? 'after' : 'before'}`;
                        if (lastDropTarget === targetKey) {
                            return;
                        }
                        lastDropTarget = targetKey;
                        if (rafId) cancelAnimationFrame(rafId);
                        rafId = requestAnimationFrame(() => {
                            if (insertAfter) {
                                row.parentNode.insertBefore(placeholder, row.nextSibling);
                            } else {
                                row.parentNode.insertBefore(placeholder, row);
                            }
                            rafId = null;
                        });
                    }
                });

                row.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                });
            
            row.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (draggedRow && placeholder && placeholder.parentNode) {
                    placeholder.parentNode.insertBefore(draggedRow, placeholder);
                    placeholder.remove();
                }
            });
        };
        
        // Apply to all current rows
        tbody.querySelectorAll('tr').forEach(makeRowDraggable);
        
        // Store reference for re-applying after render
        this._makeRowDraggable = makeRowDraggable;
    }
    
    updateDataOrderFromDOM() {
        const tbody = document.querySelector(`#${this.tableId} tbody`);
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr:not(.drag-placeholder)');
        const start = (this.currentPage - 1) * this.rowsPerPage;
        const newPageOrder = [];
        
        rows.forEach((row) => {
            const itemId = row.dataset.itemId;
            const itemIndex = parseInt(row.dataset.itemIndex);
            
            // Find the original item in currentData
            const item = this.currentData.find(d => (d.id && d.id == itemId) || this.currentData.indexOf(d) === itemIndex);
            if (item) {
                newPageOrder.push(item);
            }
        });
        
        if (newPageOrder.length > 0) {
            // Replace the current page data with reordered data
            this.currentData.splice(start, newPageOrder.length, ...newPageOrder);
            console.log('✅ Data volgorde bijgewerkt:', this.currentData);
        }
    }
    
    disableDragDrop() {
        const tbody = document.querySelector(`#${this.tableId} tbody`);
        if (!tbody) return;
        
        // Remove draggable attribute and class from all rows
        tbody.querySelectorAll('tr').forEach(row => {
            row.draggable = false;
            row.classList.remove('draggable-row');
        });
        
        // Clear the stored reference
        this._makeRowDraggable = null;
        
        console.log('❌ Drag & Drop uitgeschakeld');
    }
    
    // Public API
    refresh(newData) {
        this.originalData = newData;
        this.currentData = [...newData];
        this.currentPage = 1;
        
        // Re-populate filter dropdowns with new data
        document.querySelectorAll(`#${this.tableId} thead .filter-dropdown`).forEach(dropdown => {
            dropdown.dataset.populated = 'false';
        });
        
        this.filterAndSort();
        this.render();
    }
    
    reset() {
        this.searchQuery = '';
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.currentPage = 1;
        this.columnFilters = {}; // Clear all column filters
        this.currentData = [...this.originalData];
        
        const searchInput = document.querySelector(`#${this.tableId}-search`);
        if (searchInput) searchInput.value = '';
        
        // Reset all filter indicators
        document.querySelectorAll(`#${this.tableId} thead .filter-toggle i`).forEach(icon => {
            icon.className = 'fas fa-filter';
        });
        
        // Re-populate dropdowns
        document.querySelectorAll(`#${this.tableId} thead .filter-dropdown`).forEach(dropdown => {
            dropdown.dataset.populated = 'false';
        });
        
        this.render();
    }
    
    // Export functionality
    exportToCSV() {
        const headers = this.config.columns.map(col => col.label).join(',');
        const rows = this.currentData.map(item => {
            return this.config.columns.map(col => {
                let value = item[col.key] || '';
                // Escape quotes and wrap in quotes if contains comma
                if (String(value).includes(',') || String(value).includes('"')) {
                    value = '"' + String(value).replace(/"/g, '""') + '"';
                }
                return value;
            }).join(',');
        }).join('\n');
        
        const csv = headers + '\n' + rows;
        this.downloadFile(csv, 'export.csv', 'text/csv');
    }
    
    exportToExcel() {
        // Create HTML table for Excel
        let html = '<table>';
        
        // Headers
        html += '<thead><tr>';
        this.config.columns.forEach(col => {
            html += `<th>${col.label}</th>`;
        });
        html += '</tr></thead>';
        
        // Rows
        html += '<tbody>';
        this.currentData.forEach(item => {
            html += '<tr>';
            this.config.columns.forEach(col => {
                let value = item[col.key] || '';
                if (col.type === 'currency') {
                    value = parseFloat(value).toFixed(2);
                }
                html += `<td>${value}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        
        this.downloadFile(html, 'export.xls', 'application/vnd.ms-excel');
    }
    
    exportToPDF() {
        // Simple PDF export using print
        const printWindow = window.open('', '', 'height=600,width=800');
        
        let html = `
            <html>
            <head>
                <title>Export PDF</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f3f4f6; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9fafb; }
                </style>
            </head>
            <body>
                <h2>${this.config.title || 'Export'}</h2>
                <table>
                    <thead><tr>`;
        
        this.config.columns.forEach(col => {
            html += `<th>${col.label}</th>`;
        });
        
        html += '</tr></thead><tbody>';
        
        this.currentData.forEach(item => {
            html += '<tr>';
            this.config.columns.forEach(col => {
                let value = item[col.key] || '';
                if (col.type === 'currency') {
                    value = '€ ' + parseFloat(value).toLocaleString('nl-NL', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                }
                html += `<td>${value}</td>`;
            });
            html += '</tr>';
        });
        
        html += `</tbody></table>
                <script>window.print(); window.close();</script>
            </body></html>`;
        
        printWindow.document.write(html);
        printWindow.document.close();
    }
    
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClientTable;
}

if (typeof window !== 'undefined') {
    window.ClientTable = ClientTable;
}

export default ClientTable;
