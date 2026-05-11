#!/usr/bin/env node

/**
 * 飞书数据同步脚本（通过MCP）
 * 使用方法: node sync-feishu.js
 *
 * 此脚本通过飞书MCP读取数据，无需配置App ID和Secret
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 飞书文档配置
const SPREADSHEET_TOKEN = 'BIMhszZpohx6JItqyLYcx2VjnDf';
const SHEET_ID = 'QkhGvp';

function fetchSheetDataViaMCP() {
    console.log('🔄 正在通过飞书MCP读取数据...');

    // 使用MCP工具读取电子表格数据
    const mcpCommand = `claude mcp call feishu-mcp-pro sheet_ops '{"action":"read","params":{"spreadsheet_token":"${SPREADSHEET_TOKEN}","range":"${SHEET_ID}!A1:V30","render_option":"FormattedValue"}}'`;

    try {
        const result = execSync(mcpCommand, { encoding: 'utf-8' });
        return JSON.parse(result);
    } catch (error) {
        throw new Error(`MCP调用失败: ${error.message}`);
    }
}

function parseData(values) {
    const data = [];
    const suppliers = ['AAC', '立讯', '睿翔'];
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    let currentSupplier = null;
    let currentData = {};

    for (let i = 0; i < values.length; i++) {
        const row = values[i];
        if (!row || !row[0]) continue;

        // 检测供应商名称
        if (suppliers.includes(row[0])) {
            if (currentSupplier && Object.keys(currentData).length > 0) {
                // 保存上一个供应商的数据
                for (const month of months) {
                    if (currentData[month] && currentData[month].returnQty !== undefined) {
                        data.push({
                            supplier: currentSupplier,
                            month: month,
                            ...currentData[month]
                        });
                    }
                }
            }
            currentSupplier = row[0];
            currentData = {};
        }

        // 解析数据行
        if (currentSupplier && row[1]) {
            const category = row[1].toString().trim();
            for (let j = 2; j < 14; j++) {
                const monthIndex = j - 2;
                const month = months[monthIndex];
                if (!currentData[month]) {
                    currentData[month] = {};
                }

                const value = row[j] ? row[j].toString().trim() : '';

                switch (category) {
                    case '退料数量':
                        currentData[month].returnQty = parseInt(value) || 0;
                        break;
                    case '投入数':
                        currentData[month].inputQty = parseInt(value) || 0;
                        break;
                    case 'DPPM':
                        currentData[month].dppm = parseFloat(value) || 0;
                        break;
                    case '接收批数':
                        currentData[month].receiveBatch = parseInt(value) || 0;
                        break;
                    case '来料总批数':
                        currentData[month].totalBatch = parseInt(value) || 0;
                        break;
                    case 'IQC LAR':
                        currentData[month].lar = value || '0%';
                        break;
                }
            }
        }
    }

    // 保存最后一个供应商的数据
    if (currentSupplier && Object.keys(currentData).length > 0) {
        for (const month of months) {
            if (currentData[month] && currentData[month].returnQty !== undefined) {
                data.push({
                    supplier: currentSupplier,
                    month: month,
                    ...currentData[month]
                });
            }
        }
    }

    return data;
}

async function main() {
    try {
        // 获取数据
        const result = fetchSheetDataViaMCP();
        const values = result.values;
        console.log('✅ 成功获取飞书数据');

        // 解析数据
        const data = parseData(values);
        console.log(`✅ 解析完成: ${data.length} 条记录`);

        // 构建结果
        const output = {
            metadata: {
                title: '天线支架硬性指标数据',
                source: '飞书多维表格 - 2026年天线支架IQC数据',
                lastUpdated: new Date().toISOString().split('T')[0],
                dppmTarget: 45.9,
                larTarget: '99.13%'
            },
            data: data.map(item => ({
                ...item,
                dppmTarget: 45.9,
                larTarget: '99.13%'
            }))
        };

        // 写入文件
        const outputPath = path.join(__dirname, 'data.json');
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`✅ 数据已保存到: ${outputPath}`);

        // 显示数据摘要
        console.log('');
        console.log('📊 数据摘要:');
        const suppliersList = [...new Set(data.map(d => d.supplier))];
        suppliersList.forEach(supplier => {
            const supplierData = data.filter(d => d.supplier === supplier);
            const totalReturn = supplierData.reduce((sum, d) => sum + d.returnQty, 0);
            const totalInput = supplierData.reduce((sum, d) => sum + d.inputQty, 0);
            console.log(`  ${supplier}: 退料${totalReturn}, 投入${(totalInput/1000000).toFixed(1)}M`);
        });

        console.log('');
        console.log('🎉 同步完成！');
        console.log('   请刷新看板页面查看最新数据');

    } catch (error) {
        console.error('❌ 同步失败:', error.message);
        process.exit(1);
    }
}

main();
