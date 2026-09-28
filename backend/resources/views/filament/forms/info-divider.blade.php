<div class="flex items-center gap-3 -mt-3" x-data>
    <button
        type="button"
        class="fi-btn fi-btn-size-sm fi-btn-color-gray fi-outlined"
        @mousedown.prevent
        @click.prevent="
            const editor = $el.closest('form')?.querySelector('trix-editor');
            if (! editor) return;
            editor.focus();
            if (editor.editor && typeof editor.editor.insertHTML === 'function') {
                editor.editor.insertHTML('<hr>');
            } else {
                document.execCommand('insertHorizontalRule');
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            }
        "
    >
        <span aria-hidden="true">—</span>
        <span>Ayraç ekle</span>
    </button>
    <span class="text-sm text-gray-500 dark:text-gray-400">İmlecin bulunduğu yere yatay ayraç ekler.</span>
</div>
