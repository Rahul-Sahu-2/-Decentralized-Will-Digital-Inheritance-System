const hre = require("hardhat"); 

async function main() {
  console.log("==========================================");
  console.log("Deploying Digital Inheritance System...");
  console.log("==========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  const Project = await hre.ethers.getContractFactory("Project");
  
  console.log("Deploying Project contract...");
  
  const project = await Project.deploy();
  
  await project.waitForDeployment();
  
  const contractAddress = await project.getAddress();
  
  console.log("\n==========================================");
  console.log("✅ Deployment Successful!");
  console.log("==========================================");
  console.log("Project contract deployed to:", contractAddress);
  console.log("Network:", hre.network.name);
  console.log("Block number:", await hre.ethers.provider.getBlockNumber());
  console.log("==========================================\n");

  console.log("📝 Deployment Summary:");
  console.log("---");
  console.log(`Contract Name: Project (Digital Inheritance System)`);
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployment Time: ${new Date().toISOString()}`);
  console.log("---\n");

  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await project.deploymentTransaction().wait(6);
    
    console.log("\n🔍 Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Etherscan!");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }

  console.log("\n==========================================");
  console.log("📚 How to Use the Contract:");
  console.log("==========================================");
  console.log("1. Create a Will:");
  console.log(`   project.createWill(inactivityPeriod, { value: ethers.parseEther("1.0") })`);
  console.log("\n2. Add Beneficiaries:");
  console.log(`   project.addBeneficiaries([address1, address2], [60, 40])`);
  console.log("\n3. Check In (Reset Timer):");
  console.log(`   project.checkIn()`);
  console.log("\n4. Execute Will & Claim:");
  console.log(`   project.executeWillAndClaim(ownerAddress)`);
  console.log("==========================================\n");

  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment Failed:");
    console.error(error);
    process.exit(1);
  });

