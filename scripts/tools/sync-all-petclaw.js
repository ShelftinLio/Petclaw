// 批量同步所有 PETCLAW provider 到完整模型列表
const ModelSwitcher = require('./model-switcher');

async function syncAllPETCLAW() {
  console.log('🔄 批量同步所有 PETCLAW provider...\n');

  try {
    const switcher = new ModelSwitcher();
    const providers = switcher.getProviders();

    const petclawProviders = providers.filter(p =>
      p.baseUrl?.includes('gptclubapi') || p.features?.includes('quota-query')
    );

    if (petclawProviders.length === 0) {
      console.log('❌ 没有检测到 PETCLAW provider');
      return;
    }

    console.log(`📋 检测到 ${petclawProviders.length} 个 PETCLAW provider\n`);

    for (const p of petclawProviders) {
      console.log(`🔄 同步 ${p.name} (当前 ${p.modelCount} 个模型)...`);
      try {
        const result = await switcher.syncProviderModels(p.name);
        console.log(`   ✅ 同步完成: ${p.modelCount} → ${result.count} 个模型\n`);
      } catch (err) {
        console.log(`   ❌ 同步失败: ${err.message}\n`);
      }
    }

    console.log('✅ 批量同步完成！');
  } catch (err) {
    console.error('❌ 同步失败:', err.message);
  }
}

syncAllPETCLAW();
