const dns = require('dns').promises;

async function checkDNS() {
  console.log('🔍 Vérification DNS pour altitudevision.agency\n');

  try {
    // Vérifier les enregistrements A
    const aRecords = await dns.resolve4('altitudevision.agency');
    console.log('✅ Enregistrement A:', aRecords);

    // Vérifier les enregistrements MX
    const mxRecords = await dns.resolveMx('altitudevision.agency');
    console.log('✅ Enregistrements MX:');
    mxRecords.forEach(mx => {
      console.log(`   Priority ${mx.priority}: ${mx.exchange}`);
    });

    // Vérifier SPF
    const txtRecords = await dns.resolveTxt('altitudevision.agency');
    console.log('✅ Enregistrements TXT (SPF):');
    txtRecords.forEach(txt => {
      console.log(`   ${txt.join('')}`);
    });

    console.log('\n🎉 Configuration DNS détectée avec succès !');

  } catch (error) {
    console.log('⚠️  DNS pas encore propagé. Réessayez dans 1 heure.');
  }
}

checkDNS();