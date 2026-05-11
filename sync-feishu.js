#!/usr/bin/env node

/**
 * 飞书数据同步脚本
 * 使用方法: node sync-feishu.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 飞书应用凭证（从环境变量或配置文件读取）
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const SPREADSHEET_TOKEN = 'BIMhszZpohx6JItqyLYcx2VjnDf';
const SHEET_ID = 'QkhGvp';

async function getTenantAccessToken() {
    const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET
    });
    return response.data.tenant_access_token;
}

async function fetchSheetData() {
    const accessToken = await getTenantAccessToken();
    const response = await axios.get(
        `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${SPREADSHEET_TOKEN}/values/${SHEET_ID}!A1:V30`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            params: {
                valueRenderOption: 'FormattedValue'
            }
        }
    );
    return response.data.data.valueRange.values;
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
        console.log('🔄 正在从飞书同步数据...');

        // 检查凭证
        if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
            console.error('❌ 错误: 请设置环境变量 FEISHU_APP_ID 和 FEISHU_APP_SECRET');
            console.log('');
            console.log('设置方法:');
            console.log('  Windows PowerShell:');
            console.log('    $env:FEISHU_APP_ID="your_app_id"');
            console.log('    $env:FEISHU_APP_SECRET="your_app_secret"');
            console.log('');
            console.log('  或创建 .env 文件:');
            console.log('    FEISHU_APP_ID=your_app_id');
            console.log('    FEISHU_APP_SECRET=your_app_secret');
            process.exit(1);
        }

        // 获取数据
        const values = await fetchSheetData();
        console.log('✅ 成功获取飞书数据');

        // 解析数据
        const data = parseData(values);
        console.log(`✅ 解析完成: ${data.length} 条记录`);

        // 构建结果
        const result = {
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
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`✅ 数据已保存到: ${outputPath}`);

        // 显示数据摘要
        console.log('');
        console.log('📊 数据摘要:');
        const suppliers = [...new Set(data.map(d => d.supplier))];
        suppliers.forEach(supplier => {
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
        if (error.response) {
            console.error('   状态码:', error.response.status);
            console.error('   错误信息:', error.response.data);
        }
        process.exit(1);
    }
}

main();
