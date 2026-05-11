// Vercel Serverless Function - 飞书API代理
const axios = require('axios');

module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 获取飞书访问令牌
    const tokenResponse = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET
    });

    const accessToken = tokenResponse.data.tenant_access_token;

    // 读取电子表格数据
    const sheetResponse = await axios.get(
      'https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/BIMhszZpohx6JItqyLYcx2VjnDf/values/QkhGvp!A1:V30',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          valueRenderOption: 'FormattedValue'
        }
      }
    );

    const values = sheetResponse.data.data.valueRange.values;

    // 解析数据
    const data = parseData(values);

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

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch data from Feishu' });
  }
};

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
