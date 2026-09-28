<style>
    .info-page-rte-scroll {
        max-height: 30rem;
        min-height: 12rem;
        overflow-y: auto !important;
        overscroll-behavior: contain;
    }
</style>

<div
    class="flex items-center gap-3 -mt-3"
    x-data="{
        editor: null,
        savedRange: null,
        init() {
            this.editor = $el.closest('form')?.querySelector('trix-editor');
            if (! this.editor) return;
            this.editor.classList.add('info-page-rte-scroll');
            this.editor.addEventListener('trix-selection-change', () => {
                this.savedRange = this.editor.editor?.getSelectedRange?.() ?? null;
            });
        },
        insertDivider() {
            if (! this.editor?.editor) return;
            const trixEditor = this.editor.editor;
            if (this.savedRange) trixEditor.setSelectedRange(this.savedRange);

            if (! window.Trix.config.blockAttributes.infoDivider) {
                window.Trix.config.blockAttributes.infoDivider = {
                    tagName: 'hr',
                    terminal: true,
                    breakOnReturn: true,
                    group: false,
                };
            }

            trixEditor.activateAttribute('infoDivider');
            this.editor.dispatchEvent(new Event('input', { bubbles: true }));
            this.editor.dispatchEvent(new Event('trix-change', { bubbles: true }));
        },
    }"
>
    <button
        type="button"
        class="fi-btn fi-btn-size-sm fi-btn-color-gray fi-outlined"
        @mousedown.prevent
        @click.prevent="insertDivider()"
    >
        <span aria-hidden="true">—</span>
        <span>Ayraç ekle</span>
    </button>
    <span class="text-sm text-gray-500 dark:text-gray-400">İmlecin bulunduğu yere yatay ayraç ekler.</span>
</div>
