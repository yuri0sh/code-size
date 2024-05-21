import * as vscode from 'vscode';

export abstract class FilterRule {
	match(uri: vscode.Uri) {
		return this.matchString(uri.toString());
	}

	enabled = true;
	id?: string;

	matchString(_: string) {
		return false;
	}
}

export class FileFilterRule extends FilterRule {
	constructor(public uri: vscode.Uri) {
		super();
		this.id = uri.toString() + '+fs';
	}

	matchString(uri: string) {
		return uri === this.uri.toString();
	}
}

export class FolderFilterRule extends FilterRule {
	constructor(public uri: vscode.Uri) {
		super();
		this.id = uri.toString() + '+fd';
	}

	matchString(uri: string) {
		return uri.startsWith(this.uri.toString());
	}
}

export class RegexFilterRule extends FilterRule {
	constructor(public regex: RegExp) {
		super();
		this.id = regex.toString() + '+re';
	}

	matchString(uri: string) {
		return this.regex.test(uri);
	}
}

export class ExtensionFilterRule extends FilterRule {
	constructor(public fileExtension: string) {
		super();
		this.id = fileExtension + '+ext';
	}

	matchString(uri: string) {
		return uri.endsWith(this.fileExtension);
	}
}

export function filterRuleToJSON(rule: FilterRule) {
	if (rule instanceof FileFilterRule) {
		return {type: 'file', uri: rule.uri.toString()};
	} else if (rule instanceof FolderFilterRule) {
		return {type: 'folder', uri: rule.uri.toString()};
	} else if (rule instanceof RegexFilterRule) {
		return {type: 'regex', regex: rule.regex.toString()};
	} else if (rule instanceof ExtensionFilterRule) {
		return {type: 'extension', extension: rule.fileExtension};
	}
}

export function filterRuleFromJSON(rule: any) {
	if (rule.type === 'file') {
		return new FileFilterRule(vscode.Uri.parse(rule.uri));
	} else if (rule.type === 'folder') {
		return new FolderFilterRule(vscode.Uri.parse(rule.uri));
	} else if (rule.type === 'regex') {
		return new RegexFilterRule(new RegExp(rule.regex));
	} else if (rule.type === 'extension') {
		return new ExtensionFilterRule(rule.extension);
	}
}