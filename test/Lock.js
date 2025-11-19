const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Project - Digital Inheritance Contract", function () {
  let project;
  let owner;
  let beneficiary1;
  let beneficiary2;
  let beneficiary3;

  const INACTIVITY_PERIOD = 30 * 24 * 60 * 60; // 30 days in seconds
  const DEPOSIT_AMOUNT = ethers.parseEther("10");

  beforeEach(async function () {
    [owner, beneficiary1, beneficiary2, beneficiary3] = await ethers.getSigners();

    const Project = await ethers.getContractFactory("Project");
    project = await Project.deploy();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await project.getAddress()).to.be.properAddress;
    });
  });

  describe("Create Will", function () {
    it("Should create a will with correct parameters", async function () {
      await expect(
        project.connect(owner).createWill(INACTIVITY_PERIOD, { value: DEPOSIT_AMOUNT })
      )
        .to.emit(project, "WillCreated")
        .withArgs(owner.address, INACTIVITY_PERIOD);

      expect(await project.hasWill(owner.address)).to.be.true;

      const will = await project.wills(owner.address);
      expect(will.owner).to.equal(owner.address);
      expect(will.totalBalance).to.equal(DEPOSIT_AMOUNT);
      expect(will.inactivityPeriod).to.equal(INACTIVITY_PERIOD);
      expect(will.isExecuted).to.be.false;
    });

    it("Should fail if inactivity period is less than 30 days", async function () {
      const shortPeriod = 29 * 24 * 60 * 60; // 29 days

      await expect(
        project.connect(owner).createWill(shortPeriod, { value: DEPOSIT_AMOUNT })
      ).to.be.revertedWith("Inactivity period must be at least 30 days");
    });

    it("Should fail if no funds are deposited", async function () {
      await expect(
        project.connect(owner).createWill(INACTIVITY_PERIOD, { value: 0 })
      ).to.be.revertedWith("Must deposit funds to create will");
    });

    it("Should fail if will already exists", async function () {
      await project.connect(owner).createWill(INACTIVITY_PERIOD, { value: DEPOSIT_AMOUNT });

      await expect(
        project.connect(owner).createWill(INACTIVITY_PERIOD, { value: DEPOSIT_AMOUNT })
      ).to.be.revertedWith("Will already exists");
    });
  });

  describe("Add Beneficiaries", function () {
    beforeEach(async function () {
      await project.connect(owner).createWill(INACTIVITY_PERIOD, { value: DEPOSIT_AMOUNT });
    });

    it("Should add beneficiaries with correct percentages", async function () {
      const beneficiaries = [beneficiary1.address, beneficiary2.address];
      const percentages = [60, 40];

      await expect(
        project.connect(owner).addBeneficiaries(beneficiaries, percentages)
      )
        .to.emit(project, "BeneficiaryAdded")
        .withArgs(owner.address, beneficiary1.address, 60);

      const addedBeneficiaries = await project.getBeneficiaries(owner.address);
      expect(addedBeneficiaries.length).to.equal(2);
      expect(addedBeneficiaries[0].beneficiaryAddress).to.equal(beneficiary1.address);
      expect(addedBeneficiaries[0].percentage).to.equal(60);
      expect(addedBeneficiaries[1].beneficiaryAddress).to.equal(beneficiary2.address);
      expect(addedBeneficiaries[1].percentage).to.equal(40);
    });

    it("Should fail if percentages don't sum to 100", async function () {
      const beneficiaries = [beneficiary1.address, beneficiary2.address];
      const percentages = [60, 30]; // Sum is 90

      await expect(
        project.connect(owner).addBeneficiaries(beneficiaries, percentages)
      ).to.be.revertedWith("Total percentage must equal 100");
    });

    it("Should fail if arrays have different lengths", async function () {
      const beneficiaries = [beneficiary1.address, beneficiary2.address];
      const percentages = [100]; // Different length

      await expect(
        project.connect(owner).addBeneficiaries(beneficiaries, percentages)
      ).to.be.revertedWith("Arrays length mismatch");
    });

    it("Should fail if no will exists", async function () {
      const beneficiaries = [beneficiary1.address];
      const percentages = [100];

      await expect(
        project.connect(beneficiary1).addBeneficiaries(beneficiaries, percentages)
      ).to.be.revertedWith("No will found");
    });
  });

  describe("Check In", function () {
    beforeEach(async function () {
      await project.connect(owner).createWill(INACTIVITY_PERIOD, { value: DEPOSIT_AMOUNT });
    });

    it("Should update lastCheckIn timestamp", async function () {
      await time.increase(10 * 24 * 60 * 60); // Forward 10 days

      await expect(project.connect(owner).checkIn())
        .to.emit(project, "CheckInPerformed");

      const will = await project.wills(owner.address);
      const currentTime = await time.latest();
      expect(will.lastCheckIn).to.be.closeTo(currentTime, 2);
    });

    it("Should fail if no will exists", async function () {
      await expect(
        project.connect(beneficiary1).checkIn()
      ).to.be.revertedWith("No will found");
    });
  });

  describe("Execute Will and Claim Inheritance", function () {
    beforeEach(async function () {
      await project.connect(owner).createWill(INACTIVITY_PERIOD, { value: DEPOSIT_AMOUNT });
      
      const beneficiaries = [beneficiary1.address, beneficiary2.address];
      const percentages = [60, 40];
      await project.connect(owner).addBeneficiaries(beneficiaries, percentages);
    });

    it("Should execute will and allow beneficiary to claim", async function () {
      // Fast forward past inactivity period
      await time.increase(INACTIVITY_PERIOD + 1);

      const beneficiary1BalanceBefore = await ethers.provider.getBalance(beneficiary1.address);

      await expect(
        project.connect(beneficiary1).executeWillAndClaim(owner.address)
      )
        .to.emit(project, "WillExecuted")
        .withArgs(owner.address, DEPOSIT_AMOUNT)
        .to.emit(project, "InheritanceClaimed");

      const beneficiary1BalanceAfter = await ethers.provider.getBalance(beneficiary1.address);
      const expectedAmount = (DEPOSIT_AMOUNT * BigInt(60)) / BigInt(100);

      // Account for gas costs
      expect(beneficiary1BalanceAfter).to.be.gt(beneficiary1BalanceBefore);
    });

    it("Should fail if inactivity period not reached", async function () {
      await expect(
        project.connect(beneficiary1).executeWillAndClaim(owner.address)
      ).to.be.revertedWith("Inactivity period not reached");
    });

    it("Should fail if not a beneficiary", async function () {
      await time.increase(INACTIVITY_PERIOD + 1);

      await expect(
        project.connect(beneficiary3).executeWillAndClaim(owner.address)
      ).to.be.revertedWith("Not a beneficiary");
    });

    it("Should fail if already claimed", async function () {
      await time.increase(INACTIVITY_PERIOD + 1);

      await project.connect(beneficiary1).executeWillAndClaim(owner.address);

      await expect(
        project.connect(beneficiary1).executeWillAndClaim(owner.address)
      ).to.be.revertedWith("Already claimed");
    });

    it("Should allow multiple beneficiaries to claim", async function () {
      await time.increase(INACTIVITY_PERIOD + 1);

      await project.connect(beneficiary1).executeWillAndClaim(owner.address);
      await project.connect(beneficiary2).executeWillAndClaim(owner.address);

      const beneficiaries = await project.getBeneficiaries(owner.address);
      expect(beneficiaries[0].claimed).to.be.true;
      expect(beneficiaries[1].claimed).to.be.true;
    });
  });

  describe("Helper Functions", function () {
    beforeEach(async function () {
      await project.connect(owner).createWill(INACTIVITY_PERIOD, { value: DEPOSIT_AMOUNT });
      
      const beneficiaries = [beneficiary1.address];
      const percentages = [100];
      await project.connect(owner).addBeneficiaries(beneficiaries, percentages);
    });

    it("Should check if will can be executed", async function () {
      expect(await project.canExecuteWill(owner.address)).to.be.false;

      await time.increase(INACTIVITY_PERIOD + 1);

      expect(await project.canExecuteWill(owner.address)).to.be.true;
    });

    it("Should return beneficiaries list", async function () {
      const beneficiaries = await project.getBeneficiaries(owner.address);
      expect(beneficiaries.length).to.equal(1);
      expect(beneficiaries[0].beneficiaryAddress).to.equal(beneficiary1.address);
    });
  });
});


