class DefinitionsHandler {
    constructor() {
        this.transcriptionElement = document.getElementById('transcriptionText');
        this.setupEventListeners();
        this.isModalOpen = false;
        this.longPressTimeout = null;
        this.isLongPress = false;
    }

    setupEventListeners() {
        // Desktop right-click
        this.transcriptionElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleSelectionAction(e);
        });

        // Mobile long-press and touch events
        this.transcriptionElement.addEventListener('touchstart', (e) => {
            this.isLongPress = false;
            this.longPressTimeout = setTimeout(() => {
                this.isLongPress = true;
                const touch = e.touches[0];
                this.handleSelectionAction(touch);
            }, 500); // 500ms for long press
        });

        this.transcriptionElement.addEventListener('touchend', () => {
            clearTimeout(this.longPressTimeout);
        });

        this.transcriptionElement.addEventListener('touchmove', () => {
            clearTimeout(this.longPressTimeout);
        });

        // Close context menu when clicking/touching elsewhere
        document.addEventListener('click', (e) => {
            const contextMenu = document.querySelector('.context-menu');
            if (contextMenu && !contextMenu.contains(e.target)) {
                contextMenu.remove();
            }
        });

        // Handle escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    capitalizeText(text) {
        return text
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    handleSelectionAction(e) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        this.removeContextMenu();
        
        if (!selectedText || this.isModalOpen) return;

        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.innerHTML = `
            <div class="context-menu-item">
                <i class="bi bi-book"></i>
                Define "${selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}"
            </div>
        `;

        // Position context menu
        const rect = this.transcriptionElement.getBoundingClientRect();
        const x = e.clientX || e.pageX;
        const y = e.clientY || e.pageY;

        // Ensure menu stays within viewport
        contextMenu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
        contextMenu.style.top = `${Math.min(y, window.innerHeight - 100)}px`;

        contextMenu.querySelector('.context-menu-item').addEventListener('click', () => {
            this.getDefinition(selectedText);
            this.removeContextMenu();
        });

        document.body.appendChild(contextMenu);
    }

    removeContextMenu() {
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    async getDefinition(text) {
        try {
            const definition = await this.fetchDefinition(text);
            this.showDefinition(text, definition);
        } catch (error) {
            console.error('Error fetching definition:', error);
            alert('Sorry, there was an error getting the definition. Please try again.');
        }
    }

    async fetchDefinition(text) {
        try {
            const response = await fetch('/api/get-definition', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch definition');
            }

            if (!data.success) {
                throw new Error(data.error || 'Failed to get definition');
            }

            return data.definition;
        } catch (error) {
            console.error('Definition fetch error:', error);
            throw error;
        }
    }

    showDefinition(term, definition) {
        this.isModalOpen = true;
        
        const modal = document.createElement('div');
        modal.className = 'definition-modal';
        modal.innerHTML = `
            <div class="definition-content">
                <div class="definition-paper">
                    <div class="definition-header">
                        <h3>${this.capitalizeText(term)}</h3>
                        <button class="close-btn" aria-label="Close">×</button>
                    </div>
                    <div class="definition-body">
                        ${definition}
                    </div>
                    <div class="paper-footer">
                        <div class="paper-edge"></div>
                    </div>
                </div>
            </div>
        `;

        modal.querySelector('.close-btn').addEventListener('click', () => {
            this.closeModal();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        document.body.appendChild(modal);
    }

    closeModal() {
        const modal = document.querySelector('.definition-modal');
        if (modal) {
            modal.remove();
            this.isModalOpen = false;
            // Clear text selection
            window.getSelection().removeAllRanges();
        }
    }
}

// Initialize the handler when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DefinitionsHandler();
}); 