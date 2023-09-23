import * as vscode from 'vscode';
import { bytesToHuman } from './bytesToHuman';
import exp = require('constants');

const fs = vscode.workspace.fs;

// TODO: add .gitignore support
async function getFileSizeItem(dirUri: vscode.Uri) {
	const entries = await fs.readDirectory(dirUri);
	console.log(entries);
	const children = await Promise.all(entries.map(async ([name, type]) => {
		if (type === vscode.FileType.File) {
			let size;
			// TODO: handle errors
			size = (await vscode.workspace.fs.stat(vscode.Uri.joinPath(dirUri, name))).size;
			return new FileSizeItem(vscode.Uri.joinPath(dirUri, name), [], size);
		} else if (type === vscode.FileType.Directory) {
			return getFileSizeItem(vscode.Uri.joinPath(dirUri, name));
		}
	}));
	const childrend = children.filter((child) => child !== undefined) as FileSizeItem[];
	const totalSize = childrend.reduce((acc, cur) => acc + cur.size, 0);
	return new FileSizeItem(dirUri, childrend, totalSize);
}

class FileSizeTreeDataProvider implements vscode.TreeDataProvider<FileSizeItem> {
	getTreeItem(element: FileSizeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	getChildren(element?: FileSizeItem | undefined): vscode.ProviderResult<FileSizeItem[]> {

		if (!vscode.workspace.workspaceFolders) {
			vscode.window.showInformationMessage('No dependency in empty workspace');
			return Promise.resolve([]);
		}

		if (element === undefined) {
			return Promise.all(vscode.workspace.workspaceFolders.map((folder) => getFileSizeItem(folder.uri)));
		}

		return element!.children;
	}

	private _onDidChangeTreeData: vscode.EventEmitter<FileSizeItem | undefined | null | void> = new vscode.EventEmitter<FileSizeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<FileSizeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
	refresh(): void {
	  this._onDidChangeTreeData.fire();
	}
  
}

class FileSizeItem extends vscode.TreeItem {
	size: number;
	children: FileSizeItem[];

	constructor(itemUri: vscode.Uri, children?: FileSizeItem[], size?: number) {
		const isFolder = children?.length !== 0;
		super(itemUri, isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		this.children = children ?? [];
		this.children.sort((a, b) => b.size - a.size);
		this.size = size ?? 0;

		const fileNameFirst = vscode.workspace.getConfiguration('size').get('fileNameFirst') as Boolean;
		if (fileNameFirst) {
			this.description = bytesToHuman(this.size);
		} else {
			this.label = bytesToHuman(this.size);
			this.description = itemUri.path.split('/').pop() ?? '';
		}

		if (!isFolder) {
			this.command = {
				command: 'vscode.open',
				arguments: [itemUri],
				title: 'open file',
			};
		}
	}
}

function getFileSize(uri: vscode.Uri): Promise<number> {
	return new Promise(async (resolve, reject) => {
		await vscode.workspace.fs.stat(uri!).then((res) => {
			resolve(res.size);
		});
	});
}

export function activate(context: vscode.ExtensionContext) {
	const treeDataProvider = new FileSizeTreeDataProvider();

	let treeView = vscode.window.createTreeView('size.sizeTree', { treeDataProvider });

	let worspaceListener = vscode.workspace.onDidChangeWorkspaceFolders(treeDataProvider.refresh);
	let refresh = vscode.commands.registerCommand('size.refreshTree', treeDataProvider.refresh);
	let configListener = vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration('size')) {
			treeDataProvider.refresh();
		}
	});

	context.subscriptions.push(treeView);
	context.subscriptions.push(refresh);
	context.subscriptions.push(worspaceListener);
	context.subscriptions.push(configListener);
}

export function deactivate() {}
