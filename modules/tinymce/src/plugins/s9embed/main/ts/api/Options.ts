import Editor from 'tinymce/core/api/Editor';
import { EditorOptions } from 'tinymce/core/api/OptionTypes';

const option: {
  <K extends keyof EditorOptions>(name: K): (editor: Editor) => EditorOptions[K];
  <T>(name: string): (editor: Editor) => T;
} = (name: string) => (editor: Editor) => editor.options.get(name);

const register = (editor: Editor): void => {
  const registerOption = editor.options.register;

  registerOption('media_live_embeds', {
    processor: 'boolean',
    default: true
  });

  registerOption('media_filter_html', {
    processor: 'boolean',
    default: true
  });

  registerOption('media_dimensions', {
    processor: 'boolean',
    default: true
  });
};

const getScripts = (_editor: Editor): undefined => {
  return undefined; // editor.getParam('media_scripts');
};

const hasLiveEmbeds = option<boolean>('media_live_embeds');
const shouldFilterHtml = option<boolean>('media_filter_html');
const hasDimensions = option<boolean>('media_dimensions');

export {
  register,
  getScripts,
  hasLiveEmbeds,
  shouldFilterHtml,
  hasDimensions
};