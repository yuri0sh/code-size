import * as vscode from 'vscode';
import { FileSizeTreeDataProvider } from './FileSizeTreeProvider';

export function activate(context: vscode.ExtensionContext) {
	const treeDataProvider = new FileSizeTreeDataProvider();

	let treeView = vscode.window.createTreeView('size.sizeTree', { treeDataProvider });

	let worspaceListener = vscode.workspace.onDidChangeWorkspaceFolders( () => treeDataProvider.refresh(true));
	let refresh = vscode.commands.registerCommand('size.refreshTree', () => treeDataProvider.refresh(true));

	let modeFiles = vscode.commands.registerCommand('size.modeFiles', () => {
		vscode.commands.executeCommand('setContext', 'size.fileView', true);
		treeDataProvider.fileView = true;
		treeDataProvider.refresh(false);
	});

	let modeFolders = vscode.commands.registerCommand('size.modeFolders', () => {
		vscode.commands.executeCommand('setContext', 'size.fileView', false);
		treeDataProvider.fileView = false;
		treeDataProvider.refresh(false);
	});

	let configListener = vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration('size')) {
			treeDataProvider.refresh(false);
		}
	});

	vscode.commands.executeCommand('setContext', 'size.fileView', false);

	context.subscriptions.push(treeView);
	context.subscriptions.push(refresh);
	context.subscriptions.push(worspaceListener);
	context.subscriptions.push(configListener);
	context.subscriptions.push(modeFiles);
	context.subscriptions.push(modeFolders);
}

export function deactivate() {}
