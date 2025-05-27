require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetProjectData() {
  try {
    console.log('🗑️  Starting data reset...');
    
    // Delete in order to respect foreign key constraints
    console.log('Deleting project updates...');
    const deletedUpdates = await prisma.projectUpdate.deleteMany({});
    console.log(`✅ Deleted ${deletedUpdates.count} project updates`);
    
    console.log('Deleting projects...');
    const deletedProjects = await prisma.project.deleteMany({});
    console.log(`✅ Deleted ${deletedProjects.count} projects`);
    
    console.log('Deleting users...');
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`✅ Deleted ${deletedUsers.count} users`);
    
    console.log('🎉 Data reset completed successfully!');
    console.log('📊 All projects, updates, and users have been removed');
    
  } catch (error) {
    console.error('❌ Error during data reset:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Add confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('⚠️  This will delete ALL project data. Are you sure? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    resetProjectData()
      .then(() => {
        console.log('✨ Reset complete!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Reset failed:', error);
        process.exit(1);
      });
  } else {
    console.log('❌ Reset cancelled');
    process.exit(0);
  }
  rl.close();
}); 