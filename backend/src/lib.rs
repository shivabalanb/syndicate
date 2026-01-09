#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]
extern crate alloc;

pub mod governance;
pub mod registry;
pub mod token;

#[cfg(test)]
mod tests {
    use crate::governance::{Governance, GovernanceInitArgs};
    use crate::registry::DaoRegistry;
    use crate::token::{Token, TokenInitArgs};
    use odra::casper_types::U256;
    use odra::host::{Deployer, NoArgs};
    use odra::prelude::Addressable;

    #[test]
    fn test_full_application_flow() {
        let env = odra_test::env();
        let creator = env.get_account(0);
        let voter_alice = env.get_account(1);
        let voter_bob = env.get_account(2);

        println!("--- STARTING SYSTEM TEST ---");

        // --- STEP 1: Deploy the Registry (The "Factory") ---
        // Registry uses NoArgs because its init() is empty
        let mut registry = DaoRegistry::deploy(&env, NoArgs);
        println!("1. Registry Deployed");

        // --- STEP 2: Frontend "Creates" a DAO (Deploys Token + Gov) ---

        // A. Deploy Token
        let mut token = Token::deploy(
            &env,
            TokenInitArgs {
                name: "Alpha DAO".to_string(),
                symbol: "ALP".to_string(),
                decimals: 18,
                initial_supply: U256::from(1000), // 1000 Tokens
                recipient: creator,
                buy_rate: U256::from(10),
            },
        );
        let token_addr = token.address();
        println!("2. Token Deployed at {:?}", token_addr);

        // B. Deploy Governance (Pointing to Token)
        let mut governance = Governance::deploy(
            &env,
            GovernanceInitArgs {
                token_contract_hash: token_addr,
            },
        );
        let gov_addr = governance.address();
        println!("3. Governance Deployed at {:?}", gov_addr);

        // C. Register it in the Registry
        let dao_id = registry.register_dao(token_addr, gov_addr);
        assert_eq!(dao_id, 1);
        println!("4. DAO Registered with ID: {}", dao_id);

        // --- STEP 3: Distribute Tokens (Simulate Buying/Airdrop) ---
        // Creator sends tokens to voters so they have voting power
        env.set_caller(creator);
        token.transfer(voter_alice, U256::from(100)); // Alice gets 100
        token.transfer(voter_bob, U256::from(50)); // Bob gets 50
        println!("5. Tokens Distributed");

        // --- STEP 4: Governance Action ---

        // A. Create Proposal
        env.set_caller(creator);
        let prop_id =
            governance.create_proposal("Buy Bitcoin".to_string(), "Should we buy BTC?".to_string());
        println!("6. Proposal Created with ID: {}", prop_id);

        // B. Alice Votes YES (Weight 100)
        env.set_caller(voter_alice);
        // Important: You must approve governance to check balance if required,
        // but since we read balance directly via cross-call, no approval needed for voting.
        governance.vote(prop_id, true);
        println!("7. Alice Voted YES");

        // C. Bob Votes NO (Weight 50)
        env.set_caller(voter_bob);
        governance.vote(prop_id, false);
        println!("8. Bob Voted NO");

        // --- STEP 5: Verify Results ---
        let (yes_votes, no_votes) = governance.get_proposal_votes(prop_id);

        assert_eq!(yes_votes, U256::from(100)); // Alice's balance
        assert_eq!(no_votes, U256::from(50)); // Bob's balance
        println!("9. SUCCESS: Votes tallied correctly! (100 Yes vs 50 No)");
    }
}
