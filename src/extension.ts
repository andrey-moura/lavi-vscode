// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from "child_process";
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { once } from 'events';
import { off } from 'process';
import { buffer } from 'stream/consumers';

let output: vscode.OutputChannel;

function log(message: string) {
	if(!output) {
		output = vscode.window.createOutputChannel('andy-analyzer');
	}

	var timestamp = new Date().toISOString();

	output.appendLine(`[${timestamp}] ${message}`);
}

class SourceCodePosition {
	line: number;
	column: number;
	offset: number;

	constructor(line: number, column: number, offset: number) {
		this.line = line;
		this.column = column;
		this.offset = offset;
	}
}

class Location {
	file: string;
	start: SourceCodePosition;
	end: SourceCodePosition

	constructor(file: string, start: SourceCodePosition, end: SourceCodePosition) {
		this.file = file;
		this.start = start;
		this.end = end;
	}
}

class Declaration {
	name: string;
	location?: Location;
	type?: string;

	constructor(name: string, location: any, type: string = '') {
		this.name = name;
		this.location = location;
	}
};

class Reference {
	name: string;
	type: string;
	location: Location;

	constructor(name: string, type: string, location: any) {
		this.name = name;
		this.type = type;
		this.location = location;
	}
}

class LinterWarning {
	message: string;
	type: string;
	location: Location;

	constructor(message: string, type: string, location: any) {
		this.message = message;
		this.type = type;
		this.location = location;
	}
}

class LinterError {
	message: string;
	type: string;
	location: Location;

	constructor(message: string, type: string, location: any) {
		this.message = message;
		this.type = type;
		this.location = location;
	}
}

class Token {
	type: string;
	modifier: string;
	location: Location;

	constructor(type: string, modifier: string, location: any) {
		this.type = type;
		this.modifier = modifier;
		this.location = location;
	}
}

class AnalyzerResult {
	tokens:       Token[];
	declarations: Declaration[];
	references:   Reference[];
	linter:       LinterWarning[];
	linterErrors: LinterError[];
	

	constructor(declarations: Declaration[], references: Reference[] = [], linter: LinterWarning[] = [], linterErrors: LinterError[] = []) {
		this.declarations = [];
		this.linter = [];
		this.tokens = [];
		this.linterErrors = [];
		this.references = references;
	}
};

class AnalyzerServer {

	constructor(

	)
	{

	}

	analyse(document: vscode.TextDocument) : AnalyzerResult {
		if(document.languageId !== 'andy') {
			log("anlyse cancel, not andy language");

			return new AnalyzerResult([]);
		}

		// extensionMode === vscode.ExtensionMode.Development;
		var isDebugMode = true;
		var analyzerPath = isDebugMode ? path.join(__dirname, '../..', 'andy-lang/build/andy-analyzer') : 'andy-analyzer';
		log(`andy-analyzer path: ${analyzerPath}`);
		log(`document: ${document.fileName}`);
		var tempFileName = path.join(os.tmpdir(), document.fileName.substring(document.fileName.lastIndexOf(path.sep) + 1));
		fs.writeFileSync(tempFileName, document.getText());
		var tempOutputFileName = tempFileName + '.output';
		var command= `${analyzerPath} ${document.fileName} --temp ${tempFileName} --out ${tempOutputFileName}`;
		log(`executing command: ${command}`);
		var process = cp.exec(command, (error, stdout, stderr) => {
			if(error) {
				log(`error executing command: ${error}`);
				return;
			}
		});

		if(!process || !process.pid) {
			vscode.window.showErrorMessage('Unable to start analyzer server');
			return new AnalyzerResult([]);
		}

		log('waiting for file to exist...');

		while(!fs.existsSync(tempOutputFileName)) {
			log('file does not exist yet, waiting...');
			// Todo: sleep
		}
	
		var data = fs.readFileSync(tempOutputFileName);

		// log(`data: ${data}`);
		log(`Read ${data.length} bytes from output file`);

		try {
			var result = JSON.parse(data.toString());
		} catch (e) {
			log(`error parsing JSON: ${e}`);
			return new AnalyzerResult([]);
		}

		log('parsed data from output file');

		const tokens = result.tokens ?? [];
		const declarations = result.declarations ?? [];
		const references = result.references ?? [];
		const linter = result.linter ?? [];
		const errors = result.errors ?? [];

		log(`Converted data from JSON: tokens=${tokens.length}, declarations=${declarations.length}, references=${references.length}, linter=${linter.length}, errors=${errors.length}`);

		const analyzerResult = new AnalyzerResult([]);

		for(const token of tokens) {
			// log(`token: ${JSON.stringify(token)}`);
			const location = new Location(
				token.location.file,
				new SourceCodePosition(token.location.start.line, token.location.start.column, token.location.start.offset),
				new SourceCodePosition(token.location.end.line, token.location.end.column, token.location.end.offset)
			);

			analyzerResult.tokens.push(new Token(token.type, token.modifier, location));
		}
		
		for(const declaration of declarations) {
			// log(`declaration: ${JSON.stringify(declaration)}`);

			const location = declaration.location ? new Location(
				declaration.location.file,
				new SourceCodePosition(declaration.location.start.line, declaration.location.start.column, declaration.location.start.offset),
				new SourceCodePosition(declaration.location.end.line, declaration.location.end.column, declaration.location.end.offset)
			) : null;
			analyzerResult.declarations.push(new Declaration(declaration.name, location, declaration.type));
		}

		for(const reference of references) {
			// log(`reference: ${JSON.stringify(reference)}`);

			const location = new Location(
				reference.location.file,
				new SourceCodePosition(reference.location.start.line, reference.location.start.column, reference.location.start.offset),
				new SourceCodePosition(reference.location.end.line, reference.location.end.column, reference.location.end.offset)
			);

			analyzerResult.references.push(new Reference(reference.name, reference.type, location));
		}

		for(const warning of linter) {
			// log(`warning: ${JSON.stringify(warning)}`);

			const location = new Location(
				warning.location.file,
				new SourceCodePosition(warning.location.start.line, warning.location.start.column, warning.location.start.offset),
				new SourceCodePosition(warning.location.end.line, warning.location.end.column, warning.location.end.offset)
			);

			analyzerResult.linter.push(new LinterWarning(warning.message, warning.type, location));
		}

		for(const error of errors) {
			log(`error: ${JSON.stringify(error)}`);

			const location = new Location(
				error.location.file,
				new SourceCodePosition(error.location.start.line, error.location.start.column, error.location.start.offset),
				new SourceCodePosition(error.location.end.line, error.location.end.column, error.location.end.offset)
			);

			analyzerResult.linterErrors.push(new LinterError(error.message, error.type, location));
		}

		log('converted data to AnalyzerResult');
		return analyzerResult;
	}
};

class MyDefinitionProvider implements vscode.DefinitionProvider {
	private analyzerServer: AnalyzerServer;

    constructor(analyzerServer: AnalyzerServer) {
		this.analyzerServer = analyzerServer;
    }

    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Definition> {
        //log('DefinitionProvider called');

        const wordRange = document.getWordRangeAtPosition(position);
		
        if (!wordRange) {
            return null;
        }

        const word = document.getText(wordRange);

		var analyzerResult = this.analyzerServer.analyse(document);

		for(const declaration of analyzerResult.declarations) {
			if(declaration.name === word) {
				if(declaration.location) {
					const startPos = new vscode.Position(declaration.location.start.line, declaration.location.start.column);
					const endPos = new vscode.Position(declaration.location.end.line, declaration.location.end.column);
					const range = new vscode.Range(startPos, endPos);
					const uri = vscode.Uri.file(declaration.location.file);
					
					return new vscode.Location(uri, range);
				}
			}
		}
    }
}

function referenceRange(editor: vscode.TextEditor, reference: any, name: string) : vscode.Range{
	const startPos = editor.document.positionAt(reference.offset);
	const endPos = editor.document.positionAt(reference.offset + name.length);
	const range = new vscode.Range(startPos, endPos);

	return range;
}

const classDecorationType = vscode.window.createTextEditorDecorationType({
	color: '#4EC9B0',
	textDecoration: 'none',
});

const functionCallDecorationType = vscode.window.createTextEditorDecorationType({
	color: '#DCDCAA',
	textDecoration: 'none',
});

const variableDecorationType = vscode.window.createTextEditorDecorationType({
	color: '#9CDCFE',
	textDecoration: 'none',
});

function publishDiagnostics(document: vscode.TextDocument, result: AnalyzerResult) {
	const diagnostics: vscode.Diagnostic[] = [];

	for (const err of result.linterErrors) {
		if (err.location.file !== document.fileName) continue;

		const range = new vscode.Range(
			new vscode.Position(err.location.start.line, err.location.start.column),
			new vscode.Position(err.location.end.line, err.location.end.column)
		);

		const diagnostic = new vscode.Diagnostic(
			range,
			err.message,
			vscode.DiagnosticSeverity.Error
		);

		diagnostic.source = 'andy-analyzer';
		diagnostics.push(diagnostic);
	}

	for (const warn of result.linter) {
		if (warn.location.file !== document.fileName) continue;

		const range = new vscode.Range(
			new vscode.Position(warn.location.start.line, warn.location.start.column),
			new vscode.Position(warn.location.end.line, warn.location.end.column)
		);

		const diagnostic = new vscode.Diagnostic(
			range,
			warn.message,
			vscode.DiagnosticSeverity.Warning
		);

		diagnostic.source = 'andy-analyzer';
		diagnostics.push(diagnostic);
	}

	diagnosticCollection.set(document.uri, diagnostics);
}

const diagnosticCollection = vscode.languages.createDiagnosticCollection('meuLinter');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	log('andy-analyzer extension activated 7');

	const legend = new vscode.SemanticTokensLegend(
		['class', 'function', 'variable', 'keyword', 'string', 'number', 'comment', 'boolean', 'constant', 'preprocessor'],
		['declaration', 'defaultLibrary']
	);

	const tokenCache = new Map<string, vscode.SemanticTokens>();

	const provider: vscode.DocumentSemanticTokensProvider = {
		async provideDocumentSemanticTokens(document: vscode.TextDocument): Promise<vscode.SemanticTokens> {
			log('provideDocumentSemanticTokens called');
			const builder = new vscode.SemanticTokensBuilder(legend);
			var analyzerServer = new AnalyzerServer();
			var result = analyzerServer.analyse(document);

			// log(`result: ${JSON.stringify(result)}`);

			for(const token of result.tokens) {
				// log(`token: ${JSON.stringify(token)}`);
				// log(`Document filename: ${document.fileName}`);

				if(token.location.file == document.fileName) {
					var location = token.location;
					var start = location.start;
					var end = location.end;

					if(token.type == 'string') {
						// For symbols (:test), the token generated is test, the range does not include the :,
						// but for syntax highlighting we want to include the : as well. So we need to adjust
						// the range to include the : if it exists.

						// log('Found string token, checking for : at the beginning...');

						const lineText = document.lineAt(start.line).text;
						if(lineText[start.column - 1] === ':') {
							// log('Found : at the beginning of the string token, adjusting range...');
							start = new SourceCodePosition(start.line, start.column - 1, start.offset - 1);
						}
					}

					builder.push(
						new vscode.Range(new vscode.Position(start.line, start.column), new vscode.Position(end.line, end.column)),
						token.type,
						token.modifier == "" ? [] : [token.modifier]
					);
				}
			}

			log('pushed tokens to builder');

			// if(result.parser_errors.length > 0) {
				// This result does not contain style for classes, functions and variables. Try to reuse the previous result.
				// The previous result need to be verified to have the same tokens at the same location.
				// if(tokenCache.has(document.fileName)) {
					// const previous = tokenCache.get(document.fileName);
					// if(previous) {
						// TODO
					// }
				// }
			// }

			const built = builder.build();
			tokenCache.set(document.fileName, built);

			publishDiagnostics(document, result);
			return built;
		}
	};

	class AndyDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
		resolveDebugConfiguration(
			folder: vscode.WorkspaceFolder | undefined,
			config: vscode.DebugConfiguration
		): vscode.ProviderResult<vscode.DebugConfiguration> {
			const program = config.program || 'application.andy';

			const terminal = vscode.window.createTerminal("Andy");
			terminal.sendText(`andy ${program}`);
			terminal.show();
			return null;
		}
	}

	vscode.languages.registerDocumentSemanticTokensProvider(
		{ language: 'andy' },
		provider,
		legend
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}