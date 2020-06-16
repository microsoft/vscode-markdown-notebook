import * as assert from 'assert';
import * as vscode from 'vscode';
import { parseMarkdown, writeCellsToMarkdown } from '../../markdownParser';
import { rawToNotebookCellData } from '../../extension';

suite('parseMarkdown', () => {
	test('markdown cell', () => {
		const cells = parseMarkdown('# hello');
		assert.equal(cells.length, 1);
		assert.equal(cells[0].content, '# hello');
		assert.equal(cells[0].leadingWhitespace, '');
		assert.equal(cells[0].trailingWhitespace, '');
	});

	test('markdown cell, w/ whitespace', () => {
		const cells = parseMarkdown('\n\n# hello\n');
		assert.equal(cells.length, 1);
		assert.equal(cells[0].content, '# hello');
		assert.equal(cells[0].leadingWhitespace, '\n\n');
		assert.equal(cells[0].trailingWhitespace, '\n');
	});

	test('2 markdown cells', () => {
		const cells = parseMarkdown('# hello\n\n# goodbye\n');
		assert.equal(cells.length, 2);
		assert.equal(cells[0].content, '# hello');
		assert.equal(cells[0].leadingWhitespace, '');
		assert.equal(cells[0].trailingWhitespace, '\n\n');

		assert.equal(cells[1].content, '# goodbye');
		assert.equal(cells[1].leadingWhitespace, '');
		assert.equal(cells[1].trailingWhitespace, '\n');
	});

	test('code cell', () => {
		const cells = parseMarkdown('```js\nlet x = 1;\n```');
		assert.equal(cells.length, 1);
		assert.equal(cells[0].content, 'let x = 1;');
		assert.equal(cells[0].leadingWhitespace, '');
		assert.equal(cells[0].trailingWhitespace, '');
		assert.equal(cells[0].language, 'javascript');
	});

	test('code cell, w/whitespace', () => {
		const cells = parseMarkdown('\n\n```js\nlet x = 1;\n```\n\n');
		assert.equal(cells.length, 1);
		assert.equal(cells[0].content, 'let x = 1;');
		assert.equal(cells[0].leadingWhitespace, '\n\n');
		assert.equal(cells[0].trailingWhitespace, '\n\n');
	});

	test('code cell, markdown', () => {
		const cells = parseMarkdown('```js\nlet x = 1;\n```\n\n# hello\nfoo\n');
		assert.equal(cells.length, 2);
		assert.equal(cells[0].content, 'let x = 1;');
		assert.equal(cells[0].leadingWhitespace, '');
		assert.equal(cells[0].trailingWhitespace, '\n\n');

		assert.equal(cells[1].content, '# hello\nfoo');
		assert.equal(cells[1].leadingWhitespace, '');
		assert.equal(cells[1].trailingWhitespace, '\n');
	});

	test('markdown, code cell', () => {
		const cells = parseMarkdown('# hello\nfoo\n\n```js\nlet x = 1;\n```\n');
		assert.equal(cells.length, 2);

		assert.equal(cells[0].content, '# hello\nfoo');
		assert.equal(cells[0].leadingWhitespace, '');
		assert.equal(cells[0].trailingWhitespace, '\n\n');

		assert.equal(cells[1].content, 'let x = 1;');
		assert.equal(cells[1].leadingWhitespace, '');
		assert.equal(cells[1].trailingWhitespace, '\n');
	});
});

function cellDataToFakeCell(cell: vscode.NotebookCellData): vscode.NotebookCell {
	return {
		document: {
			getText: () => cell.source
		} as any,
		cellKind: cell.cellKind,
		language: cell.language,
		metadata: cell.metadata,
		notebook: undefined as any,
		outputs: [],
		uri: undefined as any
	};
}

suite('writeMarkdown', () => {
	function testWriteMarkdown(markdownStr: string) {
		const cells = parseMarkdown(markdownStr)
			.map(rawToNotebookCellData)
			.map(cellDataToFakeCell);
		assert.equal(writeCellsToMarkdown(cells), markdownStr);
	}

	test('writeMarkdown', () => {
		testWriteMarkdown('# hello');
		testWriteMarkdown('\n\n# hello\n\n');
		testWriteMarkdown('# hello\n\ngoodbye');

		testWriteMarkdown('```js\nlet x = 1;\n```\n\n# hello\n');
		testWriteMarkdown('```js\nlet x = 1;\n```\n\n```ts\nlet y = 2;\n```\n# hello\n');
	});
});
