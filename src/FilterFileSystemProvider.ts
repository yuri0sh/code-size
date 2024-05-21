import * as vscode from 'vscode';
import { FileSizeTreeDataProvider } from './FileSizeTreeProvider';
import { FilterRule, filterRuleFromJSON, filterRuleToJSON } from './FilterRule';

export default class FilterFileSystemProvider implements vscode.FileSystemProvider {
    constructor(private readonly _extInstance: FileSizeTreeDataProvider) { 
        this._extInstance.filterRulesFSProvider = this;
    }

    filterPass: boolean = false;
    filterRules: FilterRule[] = [];

    _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFile.event;

    watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        return new vscode.Disposable(() => { });
    }
    stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
        return {
            type: vscode.FileType.File,
            ctime: 0,
            mtime: Date.now(),
            size: 0
        };
    }
    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
        return [];
    }
    createDirectory(uri: vscode.Uri): void | Thenable<void> {
    }
    readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
        let rules = this._extInstance.filterRules;
        let array = rules.map(filterRuleToJSON);
        let data = {
            whitelist: this._extInstance.filterPass,
            rules: array
        };
        let json = JSON.stringify(data, null, 2);
        return Buffer.from(json);
    }
    writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
        let json = content.toString();
        let data;
        try {
            data = JSON.parse(json);
        } catch (e) {
            throw vscode.FileSystemError.Unavailable('Invalid JSON');
        }
        this._extInstance.filterRules = data.rules.map?.(filterRuleFromJSON);
        this._extInstance.filterPass = data.whitelist;
        this._extInstance.refresh(false);
    }
    delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
        return this._extInstance.resetFilters();
    }
    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
        throw vscode.FileSystemError.NoPermissions('not supported');
    }

    refresh(): void {
        this._onDidChangeFile.fire([{
            type: vscode.FileChangeType.Changed,
            uri: vscode.Uri.parse('size-explorer-extension:/filter.json')
        }]);
    }
}