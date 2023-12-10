import { bytesToHuman } from './bytesToHuman';
import { Ignore } from 'ignore';
import ignore from 'ignore';
import * as vscode from 'vscode';
import { GitHubFileSystemProvider, FileSystemProvider, VSCodeFileSystemProvider } from './FileSystemProviders';
import { FilterRule, RegexFilterRule, FileFilterRule, ExtensionFilterRule } from './FilterRule';

async function readFoldersGitIgnore(folderUri: vscode.Uri) {
	let gitIgnorePath = vscode.Uri.joinPath(folderUri, '.gitignore');
	try {
		let gitIgnore = await vscode.workspace.fs.readFile(gitIgnorePath);
		return new TextDecoder().decode(gitIgnore);
	} catch (e) {
		return null;
	}
}

type BranchType = 'folder' | 'extension' | 'file';

function filterRuleToTreeItem(rule: FilterRule) {
	const item: vscode.TreeItem | any = {
		label: "Unknown Filter",
		filterRule: rule,
		contextValue: 'ignoreItem',
		checkboxState: rule.enabled ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked,
	};

	if (rule instanceof RegexFilterRule) {
		item.label = rule.regex.toString();
		item.regex = rule.regex;
		item.iconPath = new vscode.ThemeIcon('regex');
		item.description = 'Regex';
	} else if (rule instanceof FileFilterRule) {
		item.label = rule.uri.path.split('/').pop() ?? '';
		item.description = rule.folder ? "Folder" : "File";
		item.resourceUri = rule.uri;
		item.collapsible = false;
		item.iconPath = rule.folder ? new vscode.ThemeIcon('folder-opened') : vscode.ThemeIcon.File;
	} else if (rule instanceof ExtensionFilterRule) {
		item.label = rule.fileExtension;
		item.iconPath = vscode.ThemeIcon.File;
		item.description = 'Extension';
	}

	return item;
}

export { FileFilterRule as IgnoreFile, RegexFilterRule as IgnoreRegex, ExtensionFilterRule as IgnoreExtension };

export class FileSizeTreeDataProvider implements vscode.TreeDataProvider<any> {
	onDidChangeCheckboxState(onDidChangeCheckboxState: vscode.TreeCheckboxChangeEvent<any>): void {
		let items = onDidChangeCheckboxState.items;
		for (let [item, state] of items) {
			item.filterRule!.enabled = state === vscode.TreeItemCheckboxState.Checked;
		}
		this.refresh(false);
	}
	filterRules: FilterRule[] = [];
	displayFoldersFirst: boolean = false;

    constructor() {
        this._updateConfig();
		this.fileSystemProviders = [
			new GitHubFileSystemProvider([]),
			new VSCodeFileSystemProvider()
		];
    }

	filterRuleToTreeItem = filterRuleToTreeItem;

	// fs providers, in order of priority
	fileSystemProviders: FileSystemProvider[];

	filterPass: boolean = false;
	
	getTreeItem(item: any): vscode.TreeItem | Thenable<vscode.TreeItem> {

		if (item.contextValue === 'ignoreRoot') {
			item.label = this.filterPass ? 'Whitelist' : 'Filter';
			item.description = `[${this.filterRules.length} rules]`;
			item.id = 'ignoreRoot';
			item.iconPath = this.filterPass ? new vscode.ThemeIcon('pass', new vscode.ThemeColor('foreground')) : new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('errorForeground'));

			return item;
		}

		if (item.contextValue === 'ignoreItem') {
			return item as FileSizeTreeItem;
		} 

		if (item.contextValue === 'fsRoot' || item.contextValue === 'extRoot' || !item.contextValue) {
			const parent = item.parent;
			let sizeString = bytesToHuman(item.size);

			let titleString = (item.resourceUri!.path.split('/').pop() ?? '');
			if (parent && item.folder) {
				titleString = item.resourceUri!.path.slice(parent.resourceUri!.path.length + 1).replace(/\//g, ' / ');
			}

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
		}

		return item;
	}

	buildTree(root: any[], branchBy: BranchType) {
		if (this.branchBy === 'file') {
			root = 
				root.flatMap((item) => this.getAllFiles(item))
					.sort((a, b) => b.size - a.size);
		}
		
		 if (this.branchBy === 'extension') {
			let exts = new Map<string, FileSizeTreeItem>();
			root.flatMap((item) => this.getAllFiles(item)).forEach((item) => {
				if (item.folder) { return; }

				let filename = item.resourceUri?.path.split('/').pop();
				let ext = filename?.includes('.') ? '.' + filename?.split('.').pop() : filename;

				if (!ext) { return; }

				if (exts.has(ext)) {
					let cached = exts.get(ext)!;
					cached.size += item.size;
					cached.totalFileCount += 1;
					cached.children.push(item);
				} else {
					let group = new FileSizeTreeItem(vscode.Uri.parse(ext), [item], item.size, true, 1, 1, 'extRoot');
					group.iconPath = vscode.ThemeIcon.File;
					exts.set(ext, group);
				}
			});

			let children = Array.from(exts.values());
			children.sort((a, b) => b.size - a.size);
			children.forEach((item) => {
				item.children.sort((a, b) => b.size - a.size);
			});
			root = children;
		}

		// adds the filter/whitelist node to the root
		if (this.filterRules.length > 0 || this.filterPass) {
			root.splice(0, 0, {
				children: this.filterRules.map(filterRuleToTreeItem),
				collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
				contextValue: 'ignoreRoot',
				ignoreRoot: true
			});
		}

		return root;
	}

	getChildren(element?: FileSizeTreeItem | undefined): ProviderResult<any[]> {
		if (element === undefined) {
			return this.getRoot().then(root => this.buildTree(root, this.branchBy));
		}

		return element!.children;
	}

	branchBy: BranchType =  vscode.workspace.getConfiguration('size').get('defaultTreeType') ?? 'folder';

    fileSizeLabelConfig: boolean = false;
    showFolderContentCountConfig: boolean = true;
	handleGitignoreConfig: boolean = true;
	compactFoldersConfig: boolean = true;


    getParent(element: FileSizeTreeItem): vscode.ProviderResult<FileSizeTreeItem> {
        return element.parent;
    }


	async providerExecAsync<T>(callback: (provider: FileSystemProvider) => Promise<T | undefined> | T | undefined): Promise<T | undefined> {
		for (let provider of this.fileSystemProviders) {
			let option = callback(provider);
			if (option instanceof Promise) {
				option = await option;
			}
			if (option !== undefined) {
				return option;
			}
		}
		return undefined;
	};

	providerExec<T>(callback: (provider: FileSystemProvider) => T | undefined): T | undefined {
		for (let provider of this.fileSystemProviders) {
			let option = callback(provider);
			if (option !== undefined) {
				return option;
			}
		}
		return undefined;
	}

	getFileChildren(uri: vscode.Uri) {
		return this.providerExec((provider) => provider.getChildren(uri));
	}

	async fetchFileChildren(uri: vscode.Uri) {
		return await this.providerExecAsync(async (provider) => {
			await provider.fetch(uri);
			return provider.getChildren(uri);
		});
	}

	getFileSize(uri: vscode.Uri) {
		return this.providerExec((provider) => provider.getSize(uri));
	}

	async fetchFileSize(uri: vscode.Uri) {
		return await this.providerExecAsync(async (provider) => {
			await provider.fetchSize(uri);
			return provider.getSize(uri);
		});
	}

	async getFileSizeItem(dirUri: vscode.Uri) {
		let entries: {uri: vscode.Uri, isFolder: boolean, filtered?: boolean}[] | undefined
			 = this.getFileChildren(dirUri) ?? await this.fetchFileChildren(dirUri);
		if (entries === undefined) {
			console.log("No file system provider found for " + dirUri.toString());
			return;
		}
		entries = entries as {uri: vscode.Uri, isFolder: boolean, filtered?: boolean}[];

		let gitignore = (el: any) => this.gitignore?.ignores((el.uri.path + (el.isFolder ? "/" : "")).slice(this.gitignoreRoot)); 
		entries = entries.filter((el) => el !== undefined && !gitignore(el));

		entries.forEach((el) => {
			let key = el.uri.toString();
			let filtered = this.filterRules.some((rule) => rule.enabled && rule.matchString(key));
			el.filtered = this.filterPass ? !filtered : filtered;
		});

		let folders = entries.filter((el) => el.isFolder);
		let files = entries.filter((el) => !el.isFolder && !el.filtered);

		let fileItems = [];
		for (let file of files) {
			let size = this.getFileSize(file.uri) ?? await this.fetchFileSize(file.uri);
			if (size === undefined) {
				console.log("No file size found for " + file.uri.toString());
				return;
			}
			fileItems.push(new FileSizeTreeItem(file.uri, [], size, false, 1, 1));
		}

		let folderItems = [];
		for (let folder of folders) {
			let folderItem: FileSizeTreeItem | undefined = await this.getFileSizeItem(folder.uri);

			if (folderItem === undefined || 
				folder.filtered && folderItem.children.length === 0) {
				continue;
			}
			if (this.compactFoldersConfig) {
				if (folderItem.children.length === 1 && folderItem.children[0].folder) {
					folderItems.push(folderItem.children[0]);
					continue;
				}
			}
			folderItems.push(folderItem);
		}

		let children: FileSizeTreeItem[];
		if (this.displayFoldersFirst) {
			children = [
				...folderItems.sort((a, b) => b.size - a.size), 
				...fileItems.sort((a, b) => b.size - a.size)
			];
		} else {
			children = [...folderItems, ...fileItems].sort((a, b) => b.size - a.size);
		}

		const totalSize = children.reduce((acc, cur) => acc + cur.size, 0);
        const totalCount = children.reduce((acc, cur) => acc + (cur.folder ? cur.totalFileCount : 1), 0);
		// const total
		return new FileSizeTreeItem(dirUri, children, totalSize, true, totalCount, 0);
	}

    getAllFiles(element: FileSizeTreeItem): FileSizeTreeItem[] {
		if (element.contextValue && element.contextValue !== 'fsRoot') {
			return [];
		}
        if (element.folder) {
            return element.children.reduce((acc, cur) => {
                if (cur.folder) {
                    return acc.concat(this.getAllFiles(cur));
                } else {
                    return acc.concat([cur]);
                }
            }, [] as FileSizeTreeItem[]);
        }
        return [element];
    }

	gitignore?: Ignore;
	gitignoreRoot: number = 0;

	gitignores: Map<string, Ignore> = new Map();

    async getRoot(): Promise<any[]> {
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			console.error('Size Extension: No workspace folders found.');
			return Promise.resolve([]);
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

		let root = res.filter(el => el) as FileSizeTreeItem[];
		root.forEach((item) => {
			item.contextValue = 'fsRoot';
		});

        return root;
    }

	private _onDidChangeTreeData: vscode.EventEmitter<FileSizeTreeItem | undefined | null | void> = new vscode.EventEmitter<FileSizeTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<FileSizeTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
    _updateConfig() {
        this.fileSizeLabelConfig = vscode.workspace.getConfiguration('size').get('fileSizeLabel') as boolean;
        this.showFolderContentCountConfig = vscode.workspace.getConfiguration('size').get('folderContentCount') as boolean;
		this.compactFoldersConfig = vscode.workspace.getConfiguration('size').get('compactFolders') as boolean;
		this.displayFoldersFirst = vscode.workspace.getConfiguration('size').get('foldersFirst') as boolean;
    }

	refresh(recalculateSize: boolean): void {
        this._updateConfig();
		if (recalculateSize) {
			this.gitignore = undefined;
			this.fileSystemProviders.forEach((provider) => provider.update());
		}
	  	this._onDidChangeTreeData.fire();
	}

	addFilterRule(rule: FilterRule) {
		if (rule.id && this.filterRules.some(el => el.id === rule.id)) {return;}
		this.filterRules.push(rule);
		this.refresh(false);
	}

	removeFilterRule(rule: FilterRule) {
		this.filterRules = this.filterRules.filter((el) => el !== rule);
		if (this.filterRules.length === 0) {
			this.setFilterPass(false);
		}
		this.refresh(false);
	}

	resetFilters() {
		this.filterRules = [];
		this.setFilterPass(false);
		this.refresh(false);
	}

	setFilterPass(filterPass: boolean) {
		this.filterPass = filterPass;
		this.refresh(false);
	}
}

function buildFileSizeTreeItem(itemUri: vscode.Uri, provider: FileSizeTreeDataProvider): FileSizeTreeItem {
	return new FileSizeTreeItem(itemUri, [], 0, true, 0, 0, 'fsRoot');
}

export class FileSizeTreeItem extends vscode.TreeItem {
	size: number;
	children: FileSizeTreeItem[];
    parent?: FileSizeTreeItem;
    folder: boolean;
    totalFileCount: number;

	constructor(itemUri: vscode.Uri, children: FileSizeTreeItem[], size: number = 0, isFolder = false, fileCount = 1, unfilteredFileCount = 1, contextValue?: string) {
		super(itemUri, isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		this.children = children;
		this.children.forEach((item) => item.parent = this);
		this.size = size;
        this.folder = isFolder;
        this.totalFileCount = fileCount;
		this.tooltip = `${itemUri.toString()} (${this.size} bytes)`;
        this.id = itemUri.path;

		if (contextValue) {
			this.contextValue = contextValue;
		};

		if (!isFolder) {
			this.command = {
				command: 'vscode.open',
				arguments: [itemUri],
				title: 'open file',
			};
		}
	}
}