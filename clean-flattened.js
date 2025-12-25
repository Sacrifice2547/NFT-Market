const fs = require('fs');
const path = require('path');

const folderPath = './flattened';

fs.readdirSync(folderPath).forEach(file => {
    if (file.endsWith('.sol')) {
        const filePath = path.join(folderPath, file);
        let buffer = fs.readFileSync(filePath);
        let content = buffer.toString('utf8').replace(/\0/g, '');

        let foundSpdx = false;
        let foundPragma = false;

        const lines = content.split('\n');
        const cleanedLines = lines.filter(line => {
            const trimmedLine = line.trim();

            // --- 新增：跳过所有以 [ 打头的日志行 ---
            if (trimmedLine.startsWith('[dotenv')) return false;

            if (trimmedLine.includes('SPDX-License-Identifier')) {
                if (!foundSpdx) {
                    foundSpdx = true;
                    return true;
                }
                return false;
            }
            if (trimmedLine.includes('pragma solidity')) {
                if (!foundPragma) {
                    foundPragma = true;
                    return true;
                }
                return false;
            }
            return true;
        });

        fs.writeFileSync(filePath, cleanedLines.join('\n'), 'utf8');
        console.log(`✅ 已清理垃圾日志并净化: ${file}`);
    }
});