import { TinyMCE } from 'tinymce/core/api/PublicApi';

declare let tinymce: TinyMCE;

tinymce.init({
  selector: 'textarea.tinymce',
  plugins: 's9embed media code preview fullpage',
  toolbar: 'undo redo | s9embed code',
  // media_dimensions: false,
  // media_live_embeds: false,
  file_picker_callback: (callback, value, meta) => {
    // Provide alternative source and posted for the media dialog
    if (meta.filetype === 'media') {
      callback('');
    }
  },
  height: 600
});

export {};