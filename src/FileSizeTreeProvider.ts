import * as vscode from 'vscode';
import { bytesToHuman } from './bytesToHuman';
const fs = vscode.workspace.fs;

export class FileSizeTreeDataProvider implements vscode.TreeDataProvider<FileSizeItem> {
    constructor() {
        this._updateConfig();
    }

	getTreeItem(element: FileSizeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	getChildren(element?: FileSizeItem | undefined): vscode.ProviderResult<FileSizeItem[]> {
		if (element === undefined) {
			let root = this.getRoot();
            if (this.fileView) {
                return root.then((root) => 
                    root.flatMap((item) => this.getAllFiles(item))
                        .sort((a, b) => b.size - a.size)
                );
            }
            return root;
		}

		return element!.children;
	}

	root?: FileSizeItem[];
    fileView: boolean = false;
    fileSizeLabel: boolean = false;
    showFolderContentCount: boolean = true;

	// TODO: Move from recursion to dynamic programming
	updateItem(item: FileSizeItem, parent?: FileSizeItem, recursive = false): FileSizeItem {
		if (this.fileSizeLabel) {
            item.label = bytesToHuman(item.size);
			item.description = (item.resourceUri!.path.split('/').pop() ?? '') + (item.folder && this.showFolderContentCount ? ` (${item.totalFileCount})` : '');
		} else {
			item.label = (item.resourceUri!.path.split('/').pop() ?? '') + (item.folder && this.showFolderContentCount ? ` (${item.totalFileCount})` : '');
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
        const totalCount = children.reduce((acc, cur) => acc + (cur.folder ? cur.totalFileCount : 1), 0);
		return new FileSizeItem(dirUri, children, totalSize, true, totalCount);
	}

    getAllFiles(element: FileSizeItem): FileSizeItem[] {
        if (element.folder) {
            return element.children.reduce((acc, cur) => {
                if (cur.folder) {
                    return acc.concat(this.getAllFiles(cur));
                } else {
                    return acc.concat([cur]);
                }
            }, [] as FileSizeItem[]);
        }
        return [element];
    }

    async getRoot(): Promise<FileSizeItem[]> {
        if (!vscode.workspace.workspaceFolders) {
			vscode.window.showInformationMessage('No files in empty workspace');
			return Promise.resolve([]);
		}

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

	private _onDidChangeTreeData: vscode.EventEmitter<FileSizeItem | undefined | null | void> = new vscode.EventEmitter<FileSizeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<FileSizeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
    _updateConfig() {
        this.fileSizeLabel = vscode.workspace.getConfiguration('size').get('fileSizeLabel') as boolean;
        this.showFolderContentCount = vscode.workspace.getConfiguration('size').get('showFolderContentCount') as boolean;
    }

	refresh(recalculateSize: boolean): void {
        this._updateConfig();
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
    folder: boolean;
    totalFileCount: number;

	constructor(itemUri: vscode.Uri, children?: FileSizeItem[], size?: number, isFolder = false, fileCount = 1) {
		super(itemUri, isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		this.children = children ?? [];
		this.children.sort((a, b) => b.size - a.size);
		this.size = size ?? 0;
        this.folder = isFolder;
        this.totalFileCount = fileCount;
        this.id = itemUri.path;

		if (!isFolder) {
			this.command = {
				command: 'vscode.open',
				arguments: [itemUri],
				title: 'open file',
			};
		}
	}
}