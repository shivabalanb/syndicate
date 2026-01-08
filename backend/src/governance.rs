use odra::{CallDef, prelude::*};
use odra::casper_types::{U256, runtime_args};

#[odra::odra_error]
pub enum GovernanceError {
    ProposalNotFound = 1,
    AlreadyVoted = 2,
    TokenContractNotSet = 3,
    NoVotingPower = 4,
    ProposalAlreadyExecuted = 5,
    ProposalDidNotPass = 6,
}

/// Proposal metadata
#[odra::odra_type]
pub struct Proposal {
    pub title: String,
    pub description: String,
    pub creator: Address,
    pub created_at: u64,
    pub yes_votes: U256,
    pub no_votes: U256,
    pub executed: bool,
}

/// Governance contract that uses CEP-18 token for weighted voting
#[odra::module]
pub struct Governance {
    /// Contract hash of the CEP-18 token contract
    token_contract: Var<Address>,
    /// Mapping: proposal_id -> proposal
    proposals: Mapping<u64, Proposal>,
    /// Mapping: (proposal_id, voter) -> has_voted
    has_voted: Mapping<(u64, Address), bool>,
    /// Counter for proposal IDs
    proposal_counter: Var<u64>,
}

#[odra::module]
impl Governance {
    /// Initialize the governance contract with the CEP-18 token contract hash
    pub fn init(&mut self, token_contract_hash: Address) {
        self.token_contract.set(token_contract_hash);
        self.proposal_counter.set(0);
    }

    /// Create a new proposal
    pub fn create_proposal(&mut self, title: String, description: String) -> u64 {
        let proposal_id = self.proposal_counter.get_or_default() + 1;
        self.proposal_counter.set(proposal_id);

        let proposal = Proposal {
            title: title.clone(),
            description: description.clone(),
            creator: self.env().caller(),
            created_at: self.env().get_block_time(),
            yes_votes: U256::zero(),
            no_votes: U256::zero(),
            executed: false,
        };

        self.proposals.set(&proposal_id, proposal);
        proposal_id
    }

    /// Vote on a proposal (true = yes, false = no)
    /// Voting power is determined by the caller's CEP-18 token balance
    pub fn vote(&mut self, proposal_id: u64, support: bool) {
        let voter = self.env().caller();
        
        // Check if proposal exists
        let mut proposal = self.proposals.get(&proposal_id)
            .unwrap_or_revert_with(&self.__env,  GovernanceError::ProposalNotFound); // Error code 1: Proposal not found
        
        // Check if already voted
        if self.has_voted.get(&(proposal_id, voter)).unwrap_or_default() {
            self.env().revert(GovernanceError::AlreadyVoted); // Error code 2: Already voted
        }

        // Check if proposal is already executed
        if proposal.executed {
            self.env().revert(GovernanceError::ProposalAlreadyExecuted); // Error code 5: Proposal already executed
        }

        // Get token contract hash
        let token_contract = self.token_contract.get()
            .unwrap_or_revert_with(&self.__env, GovernanceError::TokenContractNotSet); // Error code 3: Token contract not set

        // Cross-contract call to CEP-18: Get voter's token balance
        let voting_power = self.get_token_balance(token_contract, voter);

        // Check if user has voting power
        if voting_power == U256::zero() {
            self.env().revert(GovernanceError::NoVotingPower); // Error code 4: No voting power
        }

        // Record the vote
        self.has_voted.set(&(proposal_id, voter), true);

        // Update proposal votes
        if support {
            proposal.yes_votes += voting_power;
        } else {
            proposal.no_votes += voting_power;
        }

        self.proposals.set(&proposal_id, proposal);
    }

    /// Get token balance from CEP-18 contract (cross-contract call)
    fn get_token_balance(&self, token_contract: Address, address: Address) -> U256 {
        // Call the CEP-18 contract's balance_of entry point
        let args = runtime_args! {
       
            "owner" => address
        };

        let call_def = CallDef::new(
            String::from("balance_of"), // Entry point name
            false,                      // is_mutable (false for reading balance)
            args                        // The arguments
        );

        // Make the cross-contract call
        self.env().call_contract(
            token_contract.into(),
            call_def
        )
    }

    /// Get proposal details
    pub fn get_proposal(&self, proposal_id: u64) -> Option<Proposal> {
        self.proposals.get(&proposal_id)
    }

    /// Get total votes for a proposal
    pub fn get_proposal_votes(&self, proposal_id: u64) -> (U256, U256) {
        let proposal = self.proposals.get(&proposal_id)
            .unwrap_or_revert_with(&self.__env,GovernanceError::ProposalNotFound);
        (proposal.yes_votes, proposal.no_votes)
    }

    /// Check if a user has voted on a proposal
    pub fn has_user_voted(&self, proposal_id: u64, voter: Address) -> bool {
        self.has_voted.get(&(proposal_id, voter)).unwrap_or_default()
    }

    /// Get the token contract hash
    pub fn get_token_contract(&self) -> Option<Address> {
        self.token_contract.get()
    }

    /// Execute a proposal (if it has more yes votes than no votes)
    pub fn execute_proposal(&mut self, proposal_id: u64) {
        let mut proposal = self.proposals.get(&proposal_id)
            .unwrap_or_revert_with(&self.__env,GovernanceError::ProposalNotFound);

        if proposal.executed {
            self.env().revert(GovernanceError::ProposalAlreadyExecuted); // Already executed
        }

        if proposal.yes_votes <= proposal.no_votes {
            self.env().revert(GovernanceError::ProposalDidNotPass); // Proposal did not pass
        }

        proposal.executed = true;
        self.proposals.set(&proposal_id, proposal);
    }

    /// Get total number of proposals
    pub fn get_proposal_count(&self) -> u64 {
        self.proposal_counter.get_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, NoArgs};

    #[test]
    fn test_governance_init() {
        let env = odra_test::env();
        let dummyAddress = env.get_account(0);
        let mut governance = Governance::deploy(&env, GovernanceInitArgs{token_contract_hash:dummyAddress});
        
        // In real tests, you'd deploy a token first and pass its hash
        // let token_hash = deploy_token(&env);
        // governance.init(token_hash);
    }
}