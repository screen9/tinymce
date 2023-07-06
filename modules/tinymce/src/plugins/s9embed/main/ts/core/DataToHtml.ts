import Editor from 'tinymce/core/api/Editor';
import Tools from 'tinymce/core/api/util/Tools';

import * as HtmlToData from './HtmlToData';
import * as Mime from './Mime';
import { MediaData } from './Types';
import * as UpdateHtml from './UpdateHtml';

type DataToHtmlCallback = (data: MediaData) => string;

// allowFullscreen and source changes
const getIframeHtml = (data: MediaData) => {
  const allowFullscreen = data.allowfullscreen ? ' allowFullscreen="1"' : '';
  return '<iframe src="' + data.source + '" width="' + data.width + '" height="' + data.height + '"' + allowFullscreen + '></iframe>';
};

const dataToHtml = (editor: Editor, dataIn: MediaData): string => {
  const data: MediaData = Tools.extend({}, dataIn);

  if (!data.source) {
    Tools.extend(data, HtmlToData.htmlToData(data.embed ?? ''));
    if (!data.source) {
      return '';
    }
  }

  if (!data.altsource) {
    data.altsource = '';
  }

  if (!data.poster) {
    data.poster = '';
  }

  data.source = editor.convertURL(data.source, 'source');
  data.altsource = editor.convertURL(data.altsource, 'source');
  data.sourcemime = Mime.guess(data.source);
  data.altsourcemime = Mime.guess(data.altsource);
  data.poster = editor.convertURL(data.poster, 'poster');

  if (data.embed) {
    return UpdateHtml.updateHtml(data.embed, data, true);
  } else {
    data.width = data.width || '300';
    data.height = data.height || '150';

    Tools.each(data, (value, key) => {
      (data as Record<string, string>)[key] = editor.dom.encode('' + value);
    });

    return getIframeHtml(data);
  }
};

export {
  dataToHtml,
  DataToHtmlCallback
};