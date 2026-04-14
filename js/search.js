/**
 * GeoDataHub - 搜索交互系统
 */
class DatasetSearch {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.clearBtn = document.getElementById('clearSearchBtn');
        this.currentSearchTerm = '';
        this.isComposing = false;
        this.debounceTimer = null;
        this.init();
    }

    init() {
        if (!this.searchInput) return;

        this.searchInput.addEventListener('compositionstart', () => this.isComposing = true);
        this.searchInput.addEventListener('compositionend', (e) => {
            this.isComposing = false;
            this.onInput(e.target.value);
        });
        this.searchInput.addEventListener('input', (e) => {
            if (this.isComposing) return;
            this.onInput(e.target.value);
        });

        if (this.clearBtn) {
            this.clearBtn.onclick = () => {
                this.searchInput.value = '';
                this.onInput('');
            };
        }
    }

    onInput(val) {
        this.currentSearchTerm = val.trim().toLowerCase();
        if (this.clearBtn) {
            this.currentSearchTerm ? this.clearBtn.classList.remove('hidden') : this.clearBtn.classList.add('hidden');
        }
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            if (typeof window.applyFilters === 'function') {
                window.applyFilters(); 
            }
        }, 300);
    }
}

// 必须挂载到全局，否则 resetFilters 无法清理搜索框
window.datasetSearchInstance = new DatasetSearch();