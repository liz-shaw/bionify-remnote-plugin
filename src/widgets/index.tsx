import {
  declareIndexPlugin,
  type ReactRNPlugin,
  WidgetLocation,
} from '@remnote/plugin-sdk';

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.registerWidget(
    'bionify_reader',
    WidgetLocation.RightSidebar,
    {
      dimensions: { height: '100%', width: '100%' },
      widgetTabTitle: 'Bionify Reader',
      widgetTabIcon: `${plugin.rootURL}bionify-reader.svg`,
    }
  );

  await plugin.app.registerCommand({
    id: 'open-bionify-reader',
    name: 'Bionify Reader: Open in Right Sidebar',
    description: 'Open Bionify Reader in the RemNote right sidebar.',
    action: async () => {
      await plugin.window.openWidgetInRightSidebar('bionify_reader');
    },
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
