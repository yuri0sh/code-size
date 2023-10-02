import axios from 'axios';
import * as vscode from 'vscode';

export interface FileSystemProvider {
	getSize(uri: vscode.Uri): Promise<number | undefined>
	getChildren(uri: vscode.Uri): Promise<FileItem[] | undefined>;
	update(): void;
	init(rootUri: vscode.Uri): Promise<void>; 
}

export class VSCodeFileSystemProvider implements FileSystemProvider {
	cache = new Map<string, number>();

	async init() {

	}

	async getChildren(uri: vscode.Uri) {
		return vscode.workspace.fs.readDirectory(uri).then((entries) => {
			return entries.map(([name, type]) => {
				const fUri = vscode.Uri.joinPath(uri, name);
				return {
					uri: fUri,
					isFolder: type === vscode.FileType.Directory,
					size: type === vscode.FileType.File ? -1 : 0
				};
			});
		});
	}

	async getSize(uri: vscode.Uri): Promise<number | undefined> {
		const key = uri.toString();
		if (!this.cache.has(key)) {
			let fsStat = await vscode.workspace.fs.stat(uri);
			this.cache.set(key, fsStat.size);
		}
		return this.cache.get(key)!;
	}

	update() {
		this.cache = new Map();
	}
}

interface FileItem {
	uri: vscode.Uri;
	isFolder: boolean;
}

interface GitObject {
	path: string;
	mode: string;
	type: string;
	size: number;
	sha: string;
	url: string;

	children?: GitObject[];
	folderSize: number;
	count: number;
	uri: vscode.Uri;
}

export class GitHubFileSystemProvider implements FileSystemProvider {
	cache = new Map<string, GitObject>();
	defaultBranches: {[key: string]: string} = {};

	fsTree: any = {};
	rootUris?: vscode.Uri[];

	async getChildren(uri: vscode.Uri) {
		let gitObject = this.cache.get(uri.toString());
		if (!gitObject) {
			return undefined;
		}
		if (!gitObject!.children) {
			return [];
		}
		return gitObject!.children?.map((child) => {
			return {
				uri: child.uri,
				isFolder: child.type === 'tree'
			};
		});
	}

	async init(uri: vscode.Uri) {
		let str = uri.toString();
		if (!this.rootUris?.some(el => el.toString() === str)) {
			this.rootUris?.push(uri);
		}

		await this._initFor(uri);

		// this.cache = new Map([...this.cache.entries()].sort((a, b) => b[0].length - a[0].length));
	}

	async fetchRepoOf(uri: vscode.Uri) {
		let meta: any = uri.authority.split(/(\+|%2B)/)[2];
		meta = JSON.parse(hex2utf8(meta));
        let owner = uri.path.split('/')[1];
        let name = uri.path.split('/')[2];
        let laxios = axios.create({ baseURL: "https://api.github.com" });
		let oid;

		uri = uri.with({path: `/${owner}/${name}`});

        if (!meta) {
            let branch = (await laxios.get(`/repos/${owner}/${name}`)).data.default_branch;
			this.defaultBranches[owner + '/' + name] = branch;
            oid = (await laxios.get(`/repos/${owner}/${name}/git/refs/heads/${branch}`)).data.object.sha;
        } else if (meta.ref?.type === 2) {
			oid = meta.ref.id;
		} else if (meta.ref?.type === 3) {
			oid = (await laxios.get(`/repos/${owner}/${name}/git/pulls/${meta.ref.id}`)).data.head.sha;
		} else if (meta.ref?.type === 4) {
            oid = (await laxios.get(`/repos/${owner}/${name}/git/ref/heads/${meta.ref.id}`, {
				validateStatus: () => true
			}))?.data?.object?.sha;
			if (!oid) {
				oid = (await laxios.get(`/repos/${owner}/${name}/git/ref/tags/${meta.ref.id}`))?.data?.object?.sha;
			}
		} else {
			console.error("Size Extension: Couldn't determine ref for " + owner + '/' + name + ". Fallback to vscode API.");
			return;
		}
        let response = await laxios.get(`/repos/${owner}/${name}/git/trees/${oid}?recursive=1`);
        let trees = response.data.tree as GitObject[];

		this.cache.set(uri.toString(), {
			path: uri.path,
			uri: uri,
			mode: '040000',
			type: 'tree',
			size: 0,
			sha: oid,
			url: uri.toString(),
			children: [],
			folderSize: 0,
			count: 0
		});

        for (let object of trees) {
			if (object.type === 'tree') {
				object.folderSize = 0;
				object.count = 0;
				object.children = [];
			} else if (object.type === 'blob') {
				object.folderSize = object.size;
				object.count = 1;
				object.children = undefined;
			} else {
				continue;
			}

			object.uri = vscode.Uri.joinPath(uri, object.path as string);
		
            this.cache.set(object.uri.toString(), object);
        }
	}

	async _initFor(uri: vscode.Uri): Promise<void> {
		if (uri.scheme !== 'vscode-vfs') return;
        if (!uri.authority.startsWith('github')) return;

		try {
			await this.fetchRepoOf(uri);
			console.log("Size Extension: Folder " + uri.toString() + " will be handled with GitHub API.");
		} catch(e: any) {
			console.error("Size Extension: Couldn't fetch github repository " + uri.toString() + ". Fallback to vscode API.");
			console.error(e);
		}

		let entries = [...this.cache.entries()];
		entries.sort((a, b) => a[0].length - b[0].length);

		for (let entry of entries) {
			let lid = entry[0].lastIndexOf('/');
			let parentPath = entry[0].slice(0, lid);
			let parent = this.cache.get(parentPath);
			if (parent) {
				parent.children!.push(entry[1]);
				parent.count += entry[1].count;
				parent.folderSize += entry[1].folderSize;
			}
		}
	}

    constructor(rootUris: vscode.Uri[]) {
        rootUris.forEach((uri) => this._initFor(uri));
    }

	async getSize(uri: vscode.Uri): Promise<number| undefined> {
		if (!this.cache.has(uri.toString())) {
			return undefined;
		}
		return Promise.resolve(this.cache.get(uri.toString())!.size);
	}

	update(): void {
		this.cache = new Map();
	}
}

function hex2utf8(hexx: string) {
    return decodeURIComponent(hexx.replace(/\s+/g, '').replace(/[0-9a-f]{2}/g, '%$&'));
}
