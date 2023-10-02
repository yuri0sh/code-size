import { bytesToHuman } from './bytesToHuman';
import { Ignore } from 'ignore';
import ignore from 'ignore';
import * as vscode from 'vscode';
import { GitHubFileSystemProvider, FileSystemProvider, VSCodeFileSystemProvider } from './FileSystemProviders';

const fs = vscode.workspace.fs;

async function readFoldersGitIgnore(folderUri: vscode.Uri) {
	let gitIgnorePath = vscode.Uri.joinPath(folderUri, '.gitignore');
	try {
		let gitIgnore = await vscode.workspace.fs.readFile(gitIgnorePath);
		return new TextDecoder().decode(gitIgnore);
	} catch (e) {
		return null;
	}
}

export class FileSizeTreeDataProvider implements vscode.TreeDataProvider<FileSizeItem> {
    constructor() {
        this._updateConfig();
		this.fileSystemProviders = [
			new GitHubFileSystemProvider([]),
			new VSCodeFileSystemProvider()
		];
    }

	// fs providers, in order of priority
	fileSystemProviders: FileSystemProvider[];
	
	getTreeItem(element: FileSizeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	getChildren(element?: FileSizeItem | undefined): vscode.ProviderResult<FileSizeItem[]> {
		if (element === undefined) {
			let root = this.getRoot();
            if (this.fileViewConfig) {
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

    fileViewConfig: boolean = false;
    fileSizeLabelConfig: boolean = false;
    showFolderContentCountConfig: boolean = true;
	handleGitignoreConfig: boolean = true;

	// TODO: Move from recursion to dynamic programming
	updateItem(item: FileSizeItem, parent?: FileSizeItem, recursive = false): FileSizeItem {
		let sizeString = bytesToHuman(item.size);
		let titleString = (item.resourceUri!.path.split('/').pop() ?? '');

		if (item.folder && this.showFolderContentCountConfig) {
			if (!parent) {
				titleString += ` [${item.totalFileCount} files]`;
			} else {
				titleString += ` [${item.totalFileCount}]`;
			}
		}

		if (this.fileSizeLabelConfig) {
            item.label = sizeString;
			item.description = titleString;
		} else {
			item.label = titleString;
			item.description = sizeString;
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

	async getFileChildren(uri: vscode.Uri) {
		for (let provider of this.fileSystemProviders) {
			let option = await provider.getChildren(uri);
			if (option) {
				return option;
			}
		}
		return undefined;
	}

	async getFileSizeItem(dirUri: vscode.Uri) {
		const entries = await this.getFileChildren(dirUri);
		if (entries === undefined) {
			console.log("No file system provider found for " + dirUri.toString());
			return;
		}
		const childrenPromise = entries!.map(async ({uri, isFolder}) => {
			// // TODO: handle unignored files in ignored folders
			if (this.gitignore?.ignores(uri.path.slice(this.gitignoreRoot))) {
				return undefined;
			}

			if (!isFolder) {
				let size;
				for (let provider of this.fileSystemProviders) {
					size = await provider.getSize(uri);
					if (size !== undefined) {
						break;
					}
				}
				if (size === undefined) {
					size = -1;
				}
				return new FileSizeItem(uri, [], size);
			} else if (isFolder) {
				return this.getFileSizeItem(uri);
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

	gitignore?: Ignore;
	gitignoreRoot: number = 0;

	gitignores: Map<string, Ignore> = new Map();

    async getRoot(): Promise<FileSizeItem[]> {
        if (!vscode.workspace.workspaceFolders) {
			vscode.window.showInformationMessage('No files in empty workspace');
			return Promise.resolve([]);
		}

		for (let provider of this.fileSystemProviders) {
			for (let folder of vscode.workspace.workspaceFolders) {
				await provider.init(folder.uri);
			}
		}

		// TODO: Support for multi root workspaces
		if (this.handleGitignoreConfig && !this.gitignore) {
			let gitIgnore = await readFoldersGitIgnore(vscode.workspace.workspaceFolders![0].uri);

			if (gitIgnore !== null) {
				this.gitignoreRoot = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, '.gitignore').fsPath.length - 10;
				let ig = ignore().add(gitIgnore + '\n.git');
				
				this.gitignore = ig;
			}
		}

        let res = await Promise.all(vscode.workspace.workspaceFolders.map(async (folder) => {
			return this.getFileSizeItem(folder.uri);
		}));

		this.root = res.filter(el => el) as FileSizeItem[];
		this.root.map((item) => this.updateItem(item, undefined, true));

        return this.root;
    }

	private _onDidChangeTreeData: vscode.EventEmitter<FileSizeItem | undefined | null | void> = new vscode.EventEmitter<FileSizeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<FileSizeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
    _updateConfig() {
        this.fileSizeLabelConfig = vscode.workspace.getConfiguration('size').get('fileSizeLabel') as boolean;
        this.showFolderContentCountConfig = vscode.workspace.getConfiguration('size').get('folderContentCount') as boolean;
    }

	refresh(recalculateSize: boolean): void {
        this._updateConfig();
		if (recalculateSize) {
			this.gitignore = undefined;
			this.fileSystemProviders.forEach((provider) => provider.update());
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
		this.tooltip = `${itemUri.toString()} - ${this.size} bytes`;
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