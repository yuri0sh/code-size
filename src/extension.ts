import * as vscode from 'vscode';
import { FileSizeTreeDataProvider } from './FileSizeTreeProvider';

export function activate(context: vscode.ExtensionContext) {
	const treeDataProvider = new FileSizeTreeDataProvider();

	let treeView = vscode.window.createTreeView('size.sizeTree', { treeDataProvider });

	let worspaceListener = vscode.workspace.onDidChangeWorkspaceFolders( () => treeDataProvider.refresh(true));
	let refresh = vscode.commands.registerCommand('size.refreshTree', () => treeDataProvider.refresh(true));
	let configListener = vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration('size')) {
			treeDataProvider.refresh(false);
		}
	});

	context.subscriptions.push(treeView);
	context.subscriptions.push(refresh);
	context.subscriptions.push(worspaceListener);
	context.subscriptions.push(configListener);
}

export function deactivate() {}
