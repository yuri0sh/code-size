import * as vscode from 'vscode';
import { bytesToHuman } from './bytesToHuman';
const fs = vscode.workspace.fs;

export class FileSizeTreeDataProvider implements vscode.TreeDataProvider<FileSizeItem> {
	getTreeItem(element: FileSizeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	root?: FileSizeItem[];

	// TODO: Move from recursion to dynamic programming
	updateItem(item: FileSizeItem, parent?: FileSizeItem, recursive = false): FileSizeItem {
        const fileSizeLabel = vscode.workspace.getConfiguration('size').get('fileSizeLabel') as Boolean;
		if (fileSizeLabel) {
            item.label = bytesToHuman(item.size);
			item.description = item.resourceUri!.path.split('/').pop() ?? '';
		} else {
			item.label = item.resourceUri!.path.split('/').pop() ?? '';
			item.description = bytesToHuman(item.size);
		}
        item.parent = parent;
        
        
        if (recursive) {
            item.children.forEach(child => this.updateItem(child, item, true));
        }
		return item;
	}

    getParent(element: FileSizeItem): vscode.ProviderResult<FileSizeItem> {
        return element.parent;
    }

	// TODO: add .gitignore support
	async getFileSizeItem(dirUri: vscode.Uri) {
		const entries = await fs.readDirectory(dirUri);
		const childrenPromise = entries.map(async ([name, type]) => {
			const uri = vscode.Uri.joinPath(dirUri, name);

			if (type === vscode.FileType.File) {
				let size = (await vscode.workspace.fs.stat(uri)).size;
				return new FileSizeItem(vscode.Uri.joinPath(dirUri, name), [], size);
			} else if (type === vscode.FileType.Directory) {
				return this.getFileSizeItem(vscode.Uri.joinPath(dirUri, name));
			}
            // TODO: handle symlinks
		});
        const children = (await Promise.all(childrenPromise)).filter((child) => child !== undefined) as FileSizeItem[];
		const totalSize = children.reduce((acc, cur) => acc + cur.size, 0);
		return new FileSizeItem(dirUri, children, totalSize);
	}

	getChildren(element?: FileSizeItem | undefined): vscode.ProviderResult<FileSizeItem[]> {

		if (!vscode.workspace.workspaceFolders) {
			vscode.window.showInformationMessage('No files in empty workspace');
			return Promise.resolve([]);
		}

		if (element === undefined) {
			if (this.root) {
				return this.root.map((item) => this.updateItem(item, undefined, true));
			}

			let res = Promise.all(vscode.workspace.workspaceFolders.map((folder) => this.getFileSizeItem(folder.uri)));

			res.then((res) => {
				this.root = res;
                this.root.map((item) => this.updateItem(item, undefined, true));
			});

			return res;
		}

		return element!.children;
	}

	private _onDidChangeTreeData: vscode.EventEmitter<FileSizeItem | undefined | null | void> = new vscode.EventEmitter<FileSizeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<FileSizeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
	refresh(recalculateSize: boolean): void {
		if (recalculateSize) {
			this.root = undefined;
		}
	  	this._onDidChangeTreeData.fire();
	}
  
}

class FileSizeItem extends vscode.TreeItem {
	size: number;
	children: FileSizeItem[];
    parent?: FileSizeItem;

	constructor(itemUri: vscode.Uri, children?: FileSizeItem[], size?: number) {
		const isFolder = children?.length !== 0;
		super(itemUri, isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		this.children = children ?? [];
		this.children.sort((a, b) => b.size - a.size);
		this.size = size ?? 0;

		if (!isFolder) {
			this.command = {
				command: 'vscode.open',
				arguments: [itemUri],
				title: 'open file',
			};
		}
	}
}