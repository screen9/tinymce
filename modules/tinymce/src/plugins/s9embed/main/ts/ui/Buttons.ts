import Editor from 'tinymce/core/api/Editor';

import { isMediaElement } from '../core/Selection';

const register = (editor: Editor, url: string): void => {
  const onAction = () => editor.execCommand('mceInsertScreen9Video');
  editor.ui.registry.addIcon('s9icon', `<img src="${url + '/img/s9embed.png'}" />`);
  editor.ui.registry.addToggleButton('s9embed', {
    tooltip: editor.translate('Add/edit video'),
    icon: 's9icon',
    onAction,
    onSetup: (buttonApi) => {
      const selection = editor.selection;
      buttonApi.setActive(isMediaElement(selection.getNode()));
      return selection.selectorChangedWithUnbind('div[data-s9-embed],span[data-mce-object="iframe"]', buttonApi.setActive).unbind;
    }
  });
};

export {
  register
};