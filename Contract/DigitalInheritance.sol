// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title DigitalInheritance
 * @dev A decentralized will and digital inheritance management system
 */
contract DigitalInheritance {
    
    struct Beneficiary {
        address beneficiaryAddress;
        uint256 percentage;
        bool claimed;
    }
    
    struct Will {
        address owner;
        uint256 totalBalance;
        uint256 lastCheckIn;
        uint256 inactivityPeriod;
        bool isActive;
        bool isExecuted;
        Beneficiary[] beneficiaries;
    }
    
    mapping(address => Will) public wills;
    mapping(address => bool) public hasWill;
    
    event WillCreated(address indexed owner, uint256 inactivityPeriod);
    event BeneficiaryAdded(address indexed owner, address indexed beneficiary, uint256 percentage);
    event CheckInPerformed(address indexed owner, uint256 timestamp);
    event WillExecuted(address indexed owner, uint256 totalAmount);
    event InheritanceClaimed(address indexed beneficiary, uint256 amount);
    
    /**
     * @dev Creates a new will with specified inactivity period
     * @param _inactivityPeriod Time in seconds after which will can be executed
     */
    function createWill(uint256 _inactivityPeriod) external payable {
        require(!hasWill[msg.sender], "Will already exists");
        require(_inactivityPeriod >= 30 days, "Inactivity period must be at least 30 days");
        require(msg.value > 0, "Must deposit funds to create will");
        
        Will storage newWill = wills[msg.sender];
        newWill.owner = msg.sender;
        newWill.totalBalance = msg.value;
        newWill.lastCheckIn = block.timestamp;
        newWill.inactivityPeriod = _inactivityPeriod;
        newWill.isActive = true;
        newWill.isExecuted = false;
        
        hasWill[msg.sender] = true;
        
        emit WillCreated(msg.sender, _inactivityPeriod);
    }
    
    /**
     * @dev Adds beneficiaries to the will with their respective percentages
     * @param _beneficiaries Array of beneficiary addresses
     * @param _percentages Array of percentage allocations (must sum to 100)
     */
    function addBeneficiaries(
        address[] memory _beneficiaries,
        uint256[] memory _percentages
    ) external {
        require(hasWill[msg.sender], "No will found");
        require(!wills[msg.sender].isExecuted, "Will already executed");
        require(_beneficiaries.length == _percentages.length, "Arrays length mismatch");
        require(_beneficiaries.length > 0, "Must add at least one beneficiary");
        
        Will storage userWill = wills[msg.sender];
        
        // Clear existing beneficiaries
        delete userWill.beneficiaries;
        
        uint256 totalPercentage = 0;
        
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            require(_beneficiaries[i] != address(0), "Invalid beneficiary address");
            require(_percentages[i] > 0, "Percentage must be greater than 0");
            
            totalPercentage += _percentages[i];
            
            userWill.beneficiaries.push(Beneficiary({
                beneficiaryAddress: _beneficiaries[i],
                percentage: _percentages[i],
                claimed: false
            }));
            
            emit BeneficiaryAdded(msg.sender, _beneficiaries[i], _percentages[i]);
        }
        
        require(totalPercentage == 100, "Total percentage must equal 100");
    }
    
    /**
     * @dev Owner performs check-in to reset the inactivity timer (dead man's switch)
     */
    function checkIn() external {
        require(hasWill[msg.sender], "No will found");
        require(!wills[msg.sender].isExecuted, "Will already executed");
        
        wills[msg.sender].lastCheckIn = block.timestamp;
        
        emit CheckInPerformed(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Executes the will and allows beneficiaries to claim their inheritance
     * @param _willOwner Address of the will owner
     */
    function executeWill(address _willOwner) external {
        require(hasWill[_willOwner], "No will found for this owner");
        
        Will storage userWill = wills[_willOwner];
        
        require(!userWill.isExecuted, "Will already executed");
        require(userWill.beneficiaries.length > 0, "No beneficiaries added");
        require(
            block.timestamp >= userWill.lastCheckIn + userWill.inactivityPeriod,
            "Inactivity period not reached"
        );
        
        userWill.isExecuted = true;
        
        emit WillExecuted(_willOwner, userWill.totalBalance);
    }
    
    /**
     * @dev Allows beneficiaries to claim their inheritance after will execution
     * @param _willOwner Address of the will owner
     */
    function claimInheritance(address _willOwner) external {
        require(hasWill[_willOwner], "No will found for this owner");
        
        Will storage userWill = wills[_willOwner];
        
        require(userWill.isExecuted, "Will not yet executed");
        
        bool isBeneficiary = false;
        uint256 beneficiaryIndex;
        
        for (uint256 i = 0; i < userWill.beneficiaries.length; i++) {
            if (userWill.beneficiaries[i].beneficiaryAddress == msg.sender) {
                isBeneficiary = true;
                beneficiaryIndex = i;
                break;
            }
        }
        
        require(isBeneficiary, "Not a beneficiary");
        require(!userWill.beneficiaries[beneficiaryIndex].claimed, "Already claimed");
        
        uint256 claimAmount = (userWill.totalBalance * userWill.beneficiaries[beneficiaryIndex].percentage) / 100;
        
        userWill.beneficiaries[beneficiaryIndex].claimed = true;
        
        payable(msg.sender).transfer(claimAmount);
        
        emit InheritanceClaimed(msg.sender, claimAmount);
    }
    
    /**
     * @dev Allows owner to add more funds to their will
     */
    function depositFunds() external payable {
        require(hasWill[msg.sender], "No will found");
        require(!wills[msg.sender].isExecuted, "Will already executed");
        require(msg.value > 0, "Must deposit funds");
        
        wills[msg.sender].totalBalance += msg.value;
    }
    
    /**
     * @dev Returns beneficiary information for a specific will
     * @param _willOwner Address of the will owner
     */
    function getBeneficiaries(address _willOwner) external view returns (Beneficiary[] memory) {
        require(hasWill[_willOwner], "No will found");
        return wills[_willOwner].beneficiaries;
    }
    
    /**
     * @dev Checks if a will can be executed
     * @param _willOwner Address of the will owner
     */
    function canExecuteWill(address _willOwner) external view returns (bool) {
        if (!hasWill[_willOwner]) return false;
        
        Will storage userWill = wills[_willOwner];
        
        return !userWill.isExecuted && 
               userWill.beneficiaries.length > 0 &&
               block.timestamp >= userWill.lastCheckIn + userWill.inactivityPeriod;
    }
}
