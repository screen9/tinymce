import Editor from 'tinymce/core/api/Editor';

import * as Dialog from '../ui/Dialog';

const register = (editor: Editor): void => {
  const showDialog = () => {
    const selElm = editor.selection.getNode();
    if (selElm && (selElm.hasAttribute('data-s9-embed') || selElm.getAttribute('data-mce-object') === 'iframe')) {
      Dialog.showDialog(editor);
      return;
    }

    Dialog.showConsoleDialog(editor);
  };

  editor.addCommand('mceInsertScreen9Video', showDialog);
};

export {
  register
};