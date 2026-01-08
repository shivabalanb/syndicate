use odra::prelude::*;
use odra::casper_types::{U256};

/// CEP-18 compatible token contract for Syndicate DAO
#[odra::module]
pub struct SyndicateToken {
    /// Total supply of tokens
    total_supply: Var<U256>,
    /// Balances: address -> balance
    balances: Mapping<Address, U256>,
    /// Allowances: (owner, spender) -> amount
    allowances: Mapping<(Address, Address), U256>,
    /// Token name
    name: Var<String>,
    /// Token symbol
    symbol: Var<String>,
    /// Token decimals
    decimals: Var<u8>,
}

#[odra::module]
impl SyndicateToken {
    /// Initialize the token
    pub fn init(
        &mut self,
        name: String,
        symbol: String,
        decimals: u8,
        initial_supply: U256,
        recipient: Address,
    ) {
        self.name.set(name);
        self.symbol.set(symbol);
        self.decimals.set(decimals);
        self.total_supply.set(initial_supply);
        self.balances.set(&recipient, initial_supply);
    }

    /// Get token name
    pub fn name(&self) -> String {
        self.name.get().unwrap_or_default()
    }

    /// Get token symbol
    pub fn symbol(&self) -> String {
        self.symbol.get().unwrap_or_default()
    }

    /// Get token decimals
    pub fn decimals(&self) -> u8 {
        self.decimals.get().unwrap_or_default()
    }

    /// Get total supply
    pub fn total_supply(&self) -> U256 {
        self.total_supply.get().unwrap_or_default()
    }

    /// Get balance of an address
    pub fn balance_of(&self, owner: Address) -> U256 {
        self.balances.get(&owner).unwrap_or_default()
    }

    /// Transfer tokens to another address
    pub fn transfer(&mut self, recipient: Address, amount: U256) -> bool {
        let sender = self.env().caller();
        self.transfer_internal(sender, recipient, amount)
    }

    /// Transfer tokens from one address to another (requires allowance)
    pub fn transfer_from(
        &mut self,
        owner: Address,
        recipient: Address,
        amount: U256,
    ) -> bool {
        let spender = self.env().caller();
        let current_allowance = self.allowances.get(&(owner, spender)).unwrap_or_default();

        if current_allowance < amount {
            self.env().revert(1); // Insufficient allowance
        }

        self.allowances.set(&(owner, spender), current_allowance - amount);
        self.transfer_internal(owner, recipient, amount)
    }

    /// Approve spender to use tokens on behalf of owner
    pub fn approve(&mut self, spender: Address, amount: U256) -> bool {
        let owner = self.env().caller();
        self.allowances.set(&(owner, spender), amount);
        true
    }

    /// Get allowance
    pub fn allowance(&self, owner: Address, spender: Address) -> U256 {
        self.allowances.get(&(owner, spender)).unwrap_or_default()
    }

    /// Internal transfer function
    fn transfer_internal(&mut self, from: Address, to: Address, amount: U256) -> bool {
        if amount == U256::zero() {
            return false;
        }

        let from_balance = self.balances.get(&from).unwrap_or_default();
        if from_balance < amount {
            self.env().revert(2); // Insufficient balance
        }

        let to_balance = self.balances.get(&to).unwrap_or_default();
        self.balances.set(&from, from_balance - amount);
        self.balances.set(&to, to_balance + amount);
        true
    }

    /// Mint new tokens (for initial distribution or later)
    pub fn mint(&mut self, recipient: Address, amount: U256) {
        // In production, add access control here (e.g., only governance can mint)
        let current_supply = self.total_supply.get().unwrap_or_default();
        let recipient_balance = self.balances.get(&recipient).unwrap_or_default();
        
        self.total_supply.set(current_supply + amount);
        self.balances.set(&recipient, recipient_balance + amount);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, NoArgs};

    #[test]
    fn test_token_init() {
        let env = odra_test::env();
        let recipient = env.get_account(0);
        let mut token = SyndicateToken::deploy(
            &env,
            (
                "Syndicate Token".to_string(),
                "SYND".to_string(),
                18u8,
                U256::from(1_000_000_000_000_000_000_000_000u128),
                recipient,
            ),
        );

        assert_eq!(token.name(), "Syndicate Token");
        assert_eq!(token.symbol(), "SYND");
        assert_eq!(token.decimals(), 18);
    }

    #[test]
    fn test_transfer() {
        let env = odra_test::env();
        let sender = env.get_account(0);
        let recipient = env.get_account(1);
        let mut token = SyndicateToken::deploy(
            &env,
            (
                "Test Token".to_string(),
                "TEST".to_string(),
                18u8,
                U256::from(1_000_000_000_000_000_000_000_000u128),
                sender,
            ),
        );

        env.set_caller(sender);
        token.transfer(recipient, U256::from(100_000_000_000_000_000_000_000u128));

        assert_eq!(
            token.balance_of(recipient),
            U256::from(100_000_000_000_000_000_000_000u128)
        );
    }
}