import { Arr, Cell, Obj, Optional, Type } from '@ephox/katamari';

import Editor from 'tinymce/core/api/Editor';
import { Dialog } from 'tinymce/core/api/ui/Ui';
import Tools from 'tinymce/core/api/util/Tools';

import * as Options from '../api/Options';
import { dataToHtml } from '../core/DataToHtml';
import * as HtmlToData from '../core/HtmlToData';
import { isMediaElement } from '../core/Selection';
import * as Service from '../core/Service';
import { DialogSubData, MediaData, MediaDialogData } from '../core/Types';
import * as UpdateHtml from '../core/UpdateHtml';

type SourceInput = 'source' | 'altsource' | 'poster' | 'dimensions';

const consoleURL = 'https://console.screen9.com';
const extractMeta = (sourceInput: Exclude<SourceInput, 'dimensions'>, data: MediaDialogData): Optional<Record<string, string>> =>
  Obj.get(data, sourceInput).bind((mainData) => Obj.get(mainData, 'meta'));

const getValue = (data: MediaDialogData, metaData: Record<string, string>, sourceInput?: SourceInput) => (prop: keyof MediaDialogData): Record<string, string> => {
  // Cases:
  // 1. Get the nested value prop (component is the executed urlinput)
  // 2. Get from metadata (a urlinput was executed but urlinput != this component)
  // 3. Not a urlinput so just get string
  // If prop === sourceInput do 1, 2 then 3, else do 2 then 1 or 3
  // ASSUMPTION: we only want to get values for props that already exist in data
  const getFromData = (): Optional<string | Record<string, string> | DialogSubData> => Obj.get(data, prop);
  const getFromMetaData = (): Optional<string> => Obj.get(metaData, prop);
  const getNonEmptyValue = (c: Record<string, string>): Optional<string> => Obj.get(c, 'value').bind((v: string) => v.length > 0 ? Optional.some(v) : Optional.none());

  const getFromValueFirst = () => getFromData().bind((child) => Type.isObject(child)
    ? getNonEmptyValue(child as Record<string, string>).orThunk(getFromMetaData)
    : getFromMetaData().orThunk(() => Optional.from(child as string)));

  const getFromMetaFirst = () => getFromMetaData().orThunk(() => getFromData().bind((child) => Type.isObject(child)
    ? getNonEmptyValue(child as Record<string, string>)
    : Optional.from(child as string)));

  return { [prop]: (prop === sourceInput ? getFromValueFirst() : getFromMetaFirst()).getOr('') };
};

const getDimensions = (data: MediaDialogData, metaData: Record<string, string>): MediaDialogData['dimensions'] => {
  const dimensions: MediaDialogData['dimensions'] = {};
  Obj.get(data, 'dimensions').each((dims) => {
    Arr.each([ 'width', 'height' ] as ('width' | 'height')[], (prop) => {
      Obj.get(metaData, prop).orThunk(() => Obj.get(dims, prop)).each((value) => dimensions[prop] = value);
    });
  });
  return dimensions;
};

const unwrap = (data: MediaDialogData, sourceInput?: SourceInput): MediaData => {
  const metaData = sourceInput && sourceInput !== 'dimensions' ? extractMeta(sourceInput, data).getOr({}) : {};
  const get = getValue(data, metaData, sourceInput);
  return {
    ...get('source'),
    ...get('altsource'),
    ...get('poster'),
    ...get('embed'),
    ...getDimensions(data, metaData)
  } as MediaData;
};

const wrap = (data: MediaData): MediaDialogData => {
  const wrapped: MediaDialogData = {
    ...data,
    source: { value: Obj.get(data, 'source').getOr('') },
    altsource: { value: Obj.get(data, 'altsource').getOr('') },
    poster: { value: Obj.get(data, 'poster').getOr('') }
  };

  // Add additional size values that may or may not have been in the html
  Arr.each([ 'width', 'height' ] as const, (prop) => {
    Obj.get(data, prop).each((value) => {
      const dimensions: MediaDialogData['dimensions'] = wrapped.dimensions || {};
      dimensions[prop] = value;
      wrapped.dimensions = dimensions;
    });
  });

  return wrapped;
};

const handleError = (editor: Editor) => (error?: { msg: string }): void => {
  const errorMessage = error && error.msg ?
    'Media embed handler error: ' + error.msg :
    'Media embed handler threw unknown error.';
  editor.notificationManager.open({ type: 'error', text: errorMessage });
};

const getEditorData = (editor: Editor): MediaData => {
  const element = editor.selection.getNode();
  const snippet = isMediaElement(element) ? editor.serializer.serialize(element, { selection: true }) : '';
  return {
    embed: snippet,
    ...HtmlToData.htmlToData(snippet, editor.schema)
  };
};

const addEmbedHtml = (api: Dialog.DialogInstanceApi<MediaDialogData>, editor: Editor) => (response: Service.EmbedResult): void => {
  // Only set values if a URL has been defined
  if (Type.isString(response.url) && response.url.trim().length > 0) {
    const html = response.html;
    const snippetData = HtmlToData.htmlToData(html, editor.schema);
    const nuData: MediaData = {
      ...snippetData,
      source: response.url,
      embed: html
    };

    api.setData(wrap(nuData));
  }
};

const selectPlaceholder = (editor: Editor, beforeObjects: HTMLElement[]): void => {
  const afterObjects = editor.dom.select('*[data-mce-object]');

  // Find new image placeholder so we can select it
  for (let i = 0; i < beforeObjects.length; i++) {
    for (let y = afterObjects.length - 1; y >= 0; y--) {
      if (beforeObjects[i] === afterObjects[y]) {
        afterObjects.splice(y, 1);
      }
    }
  }

  editor.selection.select(afterObjects[0]);
};

const handleInsert = (editor: Editor, html: string): void => {
  const beforeObjects = editor.dom.select('*[data-mce-object]');

  editor.insertContent(html);
  selectPlaceholder(editor, beforeObjects);
  editor.nodeChanged();
};

const submitForm = (prevData: MediaData, newData: MediaData, editor: Editor): void => {
  newData.embed = UpdateHtml.updateHtml(newData.embed ?? '', newData, false, editor.schema);

  // Only fetch the embed HTML content if the URL has changed from what it previously was
  if (newData.embed && (prevData.source === newData.source || Service.isCached(newData.source))) {
    handleInsert(editor, newData.embed);
  } else {
    Service.getEmbedHtml(editor, newData)
      .then((response) => {
        handleInsert(editor, response.html);
      }).catch(handleError(editor));
  }
};

const updateEmbedSource = (data: MediaData) => {
  const elem = document.createElement('div');
  elem.innerHTML = data.embed || '';
  const embedIframe = elem.getElementsByTagName('iframe')[0];
  const divElm = elem.getElementsByTagName('div')[0];

  if (divElm) {
    embedIframe.src = data.source;
    divElm.setAttribute('data-ephox-embed-iri', embedIframe.src);
    data.embed = divElm.outerHTML;
  }
  return data;
};

const createIFrame = (editor: Editor, data: any) => {
  const embed = data.embed;
  const resolution = (data.ondemand || data.source).resolution || [ 16, 9 ];
  const elem = document.createElement('div');
  elem.innerHTML = embed;
  const embedIframe = elem.getElementsByTagName('iframe')[0];
  const divElm = elem.getElementsByTagName('div')[0];

  if (divElm) {
    divElm.setAttribute('data-ephox-embed-iri', embedIframe.src);
    divElm.setAttribute('data-s9-embed', '');
    divElm.setAttribute('contentEditable', 'false');
    divElm.style.paddingBottom = '0';
    divElm.style.maxWidth = '100%';
    divElm.style.border = '0';
    (divElm.style as any).aspectRatio = resolution[0] / resolution[1];

    divElm.classList.add('s9-embed-container', 'mce-preview-object');

    return divElm.outerHTML;
  }
  const editorBody = editor.getBody();
  const editorBodyWidth = Math.floor(editorBody ? editorBody.clientWidth - 6 : 480);

  if (parseInt(embedIframe.width, 10) > editorBodyWidth) {
    embedIframe.height = Math.floor(
      editorBodyWidth / parseInt(embedIframe.width, 10) * parseInt(embedIframe.height, 10)).toString();
    embedIframe.width = editorBodyWidth.toString();
  }
  return embedIframe.outerHTML;
};

const showConsoleDialog = (editor: Editor, api?: Dialog.DialogInstanceApi<MediaDialogData>): void => {
  const postMessageHandler = (message: MessageEvent) => {
    // checks screen9 origin
    const origin = message.origin || '';
    if (origin.indexOf(consoleURL) === 0) {
      if (api) {
        let data = unwrap(api.getData());

        data.embed = createIFrame(editor, message.data);
        data = Tools.extend(data, HtmlToData.htmlToData(data.embed));

        Service.getEmbedHtml(editor, data)
          .then(addEmbedHtml(api, editor))
          .catch(handleError(editor));
      } else {
        editor.execCommand('mceInsertContent', false, createIFrame(editor, message.data));
      }
      win.close();
    }
  };

  const win = editor.windowManager.open({
    title: editor.translate('Click insert to publish your video.'),
    size: 'large',
    body: {
      type: 'panel',
      classes: [ 's9-modal-container' ],
      items: [{
        type: 'htmlpanel',
        html: '<iframe frameborder="0"\
        src="' + consoleURL + '/3/#/mode/"\
        allow="autoplay; fullscreen; camera; microphone; encrypted-media; gyroscope; web-share" allowfullscreen\
        style="width: 100%;height: 100%;position: absolute;margin-left: -16px;"></iframe>'
      }]
    },
    buttons: [],
    onClose: () => {
      window.removeEventListener('message', postMessageHandler);
    }
  });
  window.addEventListener('message', postMessageHandler);
};

const showDialog = (editor: Editor): void => {
  const editorData = getEditorData(editor);
  const currentData = Cell<MediaData>(editorData);
  const initialData = wrap(editorData);
  let lastSelection: HTMLElement | undefined;

  const handleSource = (prevData: MediaData, api: Dialog.DialogInstanceApi<MediaDialogData>): void => {
    const serviceData = unwrap(api.getData(), 'source');

    // If a new URL is entered, then clear the embed html and fetch the new data
    if (prevData.source !== serviceData.source) {
      addEmbedHtml(win, editor)({ url: serviceData.source, html: '' });

      Service.getEmbedHtml(editor, updateEmbedSource(serviceData))
        .then(addEmbedHtml(win, editor))
        .catch(handleError(editor));
    }
  };

  const handleEmbed = (api: Dialog.DialogInstanceApi<MediaDialogData>): void => {
    const data = unwrap(api.getData());
    const dataFromEmbed = HtmlToData.htmlToData(data.embed ?? '', editor.schema);
    api.setData(wrap(dataFromEmbed));
  };

  const handleUpdate = (api: Dialog.DialogInstanceApi<MediaDialogData>, sourceInput: SourceInput): void => {
    const data = unwrap(api.getData(), sourceInput);
    const embed = dataToHtml(editor, data);
    api.setData(wrap({
      ...data,
      embed
    }));
  };

  const mediaInput: Dialog.UrlInputSpec[] = [{
    name: 'source',
    type: 'urlinput',
    filetype: 'media',
    label: 'Source',
  }];

  const mediaButton: Dialog.ButtonSpec[] = [{
    icon: 'browse',
    name: 'mediasource',
    text: editor.translate('Source'),
    type: 'button',
    borderless: true
  }];

  const sizeInput: Dialog.SizeInputSpec[] = !Options.hasDimensions(editor) ? [] : [{
    type: 'sizeinput',
    name: 'dimensions',
    label: 'Constrain proportions',
    constrain: true
  }];
  const emptyPanel: Dialog.PanelSpec[] = [{
    type: 'panel',
    classes: [ 's9-tmce-tab-panel' ],
    items: []
  }];
  const generalTab = {
    title: 'General',
    name: 'general',
    items: Arr.flatten<Dialog.BodyComponentSpec>([ emptyPanel, mediaInput, mediaButton, sizeInput ])
  };

  const embedTextarea: Dialog.TextAreaSpec = {
    type: 'textarea',
    name: 'embed',
    label: 'Paste your embed code below:'
  };
  const embedTab = {
    title: 'Embed',
    items: [
      embedTextarea
    ]
  };

  const tabs = [
    generalTab,
    embedTab
  ];

  const body: Dialog.TabPanelSpec = {
    type: 'tabpanel',
    tabs
  };
  const win = editor.windowManager.open<MediaDialogData>({
    title: editor.translate('Edit Quickchannel media'),
    size: 'medium',

    body,
    buttons: [
      {
        type: 'cancel',
        name: 'cancel',
        text: 'Cancel'
      },
      {
        type: 'submit',
        name: 'save',
        text: 'Save',
        primary: true
      }
    ],
    onAction: (api) => {
      lastSelection = editor.selection.getNode();
      showConsoleDialog(editor, api);
    },
    onTabChange: () => {
      replaceMediaPickerButton();
    },
    onSubmit: (api) => {
      if (lastSelection) {
        editor.selection.select(lastSelection);
        lastSelection = undefined;
      }
      const serviceData = unwrap(api.getData());
      submitForm(currentData.get(), serviceData, editor);
      setTimeout(() => {
        api.close();
      }, 100);
    },
    onChange: (api, detail) => {
      switch (detail.name) {
        case 'source':
          handleSource(currentData.get(), api);
          break;

        case 'embed':
          handleEmbed(api);
          break;

        case 'dimensions':
        case 'altsource':
        case 'poster':
          handleUpdate(api, detail.name);
          break;

        default:
          break;
      }
      currentData.set(unwrap(api.getData()));
    },
    initialData
  });

  const replaceMediaPickerButton = () => {
    setTimeout(() => {
      const s9PanelParentEl = editor.dom.win.document.querySelector('.s9-tmce-tab-panel')?.parentElement;
      const buttons = s9PanelParentEl?.querySelectorAll('button') || [];
      if (buttons.length >= 2) {
        editor.dom.replace(buttons[1], buttons[0]);
      }
    }, 10);
  };

  replaceMediaPickerButton();
};

export {
  showConsoleDialog,
  showDialog,
  unwrap
};
