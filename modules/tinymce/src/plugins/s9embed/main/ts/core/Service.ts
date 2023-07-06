import { Obj } from '@ephox/katamari';

import Editor from 'tinymce/core/api/Editor';

import * as DataToHtml from './DataToHtml';
import { MediaData } from './Types';

export interface EmbedResult {
  readonly url: string;
  readonly html: string;
}

interface EmbedResponse {
  readonly html?: string;
}

export type MediaResolver = (data: { url: string }, resolve: (response: EmbedResponse) => void, reject: (reason?: any) => void) => void;

const cache: Record<string, EmbedResponse> = {};

const defaultPromise = (data: MediaData, dataToHtml: DataToHtml.DataToHtmlCallback): Promise<EmbedResult> =>
  Promise.resolve({ html: dataToHtml(data), url: data.source });

const loadedData = (editor: Editor) => (data: MediaData): string =>
  DataToHtml.dataToHtml(editor, data);

const getEmbedHtml = (editor: Editor, data: MediaData): Promise<EmbedResult> => {
  return defaultPromise(data, loadedData(editor));
};

const isCached = (url: string): boolean =>
  Obj.has(cache, url);

export {
  getEmbedHtml,
  isCached
};
