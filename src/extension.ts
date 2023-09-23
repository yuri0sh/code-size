import * as vscode from 'vscode';
import { bytesToHuman } from './bytesToHuman';

const fs = vscode.workspace.fs;

// TODO: add .gitignore support
async function getFileSizeItem(dirUri: vscode.Uri) {
	const entries = await fs.readDirectory(dirUri);
	const children = await Promise.all(entries.map(async ([name, type]) => {
		if (type === vscode.FileType.File) {
			const size = await getFileSize(vscode.Uri.joinPath(dirUri, name));
			return new FileSizeItem(vscode.Uri.joinPath(dirUri, name), [], size);
		} else if (type === vscode.FileType.Directory) {
			const size = await getFolderSize(vscode.Uri.joinPath(dirUri, name));
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
		this.description = bytesToHuman(this.size);
		this.label = itemUri.path.split('/').pop() ?? '';

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
	return new Promise((resolve, reject) => {
		vscode.workspace.fs.stat(uri!).then((res) => {
			resolve(res.size);
		});
	});
}

function getFolderSize(uri: vscode.Uri): Promise<number> {
	return new Promise((resolve, reject) => {
		vscode.workspace.fs.readDirectory(uri!).then((entries) => {
			let totalSize = 0;
			let counted = 0;
			for (const [name, type] of entries) {
				if (type === vscode.FileType.File) {
					getFileSize(vscode.Uri.joinPath(uri!, name)).then((res) => {
						totalSize += res;
						if (++counted === entries.length) {
							resolve(totalSize);
						}
					});
				} else if (type === vscode.FileType.Directory) {
					getFolderSize(vscode.Uri.joinPath(uri!, name)).then((res) => {
						totalSize += res;
						if (++counted === entries.length) {
							resolve(totalSize);
						}
					});
				}
			}
		});
	});
}


export function activate(context: vscode.ExtensionContext) {
	const treeDataProvider = new FileSizeTreeDataProvider();
	let disposable = vscode.window.registerTreeDataProvider('size.sizeTree', treeDataProvider);

	context.subscriptions.push(disposable);
}

export function deactivate() {}
