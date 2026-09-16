import type { ReactRNPlugin, Rem } from '@remnote/plugin-sdk';

export type RemTreeNode = {
  id: string;
  text: string;
  backText: string;
  children: RemTreeNode[];
};

export type ReadTreeOptions = {
  includeBackText: boolean;
  maxDepth: number;
  maxNodes: number;
};

export type ReadTreeResult = {
  root: RemTreeNode;
  truncated: boolean;
  nodeCount: number;
};

async function richTextToString(
  plugin: ReactRNPlugin,
  richText: Rem['text'] | Rem['backText'] | undefined
): Promise<string> {
  if (!richText || richText.length === 0) return '';
  return (await plugin.richText.toString(richText)) ?? '';
}

export async function readRemTree(
  plugin: ReactRNPlugin,
  rootRem: Rem,
  options: ReadTreeOptions
): Promise<ReadTreeResult> {
  let nodeCount = 0;
  let truncated = false;

  async function visit(rem: Rem, depth: number): Promise<RemTreeNode> {
    nodeCount += 1;

    const [text, backText] = await Promise.all([
      richTextToString(plugin, rem.text),
      options.includeBackText
        ? richTextToString(plugin, rem.backText)
        : Promise.resolve(''),
    ]);

    if (depth >= options.maxDepth || nodeCount >= options.maxNodes) {
      if (nodeCount >= options.maxNodes) truncated = true;
      return {
        id: rem._id,
        text,
        backText,
        children: [],
      };
    }

    const childRems = (await rem.getChildrenRem()) || [];
    const children: RemTreeNode[] = [];

    for (const child of childRems) {
      if (nodeCount >= options.maxNodes) {
        truncated = true;
        break;
      }
      children.push(await visit(child, depth + 1));
    }

    return {
      id: rem._id,
      text,
      backText,
      children,
    };
  }

  const root = await visit(rootRem, 0);
  return { root, truncated, nodeCount };
}

export function collectTreeIds(root: RemTreeNode | null): Set<string> {
  const ids = new Set<string>();
  if (!root) return ids;

  const stack: RemTreeNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    ids.add(node.id);
    stack.push(...node.children);
  }

  return ids;
}
