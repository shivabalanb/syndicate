use odra::prelude::*;

/// Information about a registered DAO
/// Note: name and symbol should be queried from the token contract
#[odra::odra_type]
pub struct DaoInfo {
    pub token_address: Address,
    pub governance_address: Address,
    pub creator: Address,
    pub created_at: u64,
}

/// Registry contract that tracks all DAOs created
#[odra::module]
pub struct DaoRegistry {
    /// List of all DAOs created
    daos: Var<Vec<DaoInfo>>,
    /// Mapping: dao_id -> DaoInfo (for quick lookup)
    dao_by_id: Mapping<u64, DaoInfo>,
    /// Counter for DAO IDs
    dao_counter: Var<u64>,
}

#[odra::module]
impl DaoRegistry {
    /// Initialize the registry
    pub fn init(&mut self) {
        self.daos.set(Vec::new());
        self.dao_counter.set(0);
    }

    /// Register a new DAO after deploying Token and Governance contracts
    /// Call this from the frontend after deploying both contracts
    /// Note: Token name and symbol can be queried from the token contract
    pub fn register_dao(&mut self, token_address: Address, governance_address: Address) -> u64 {
        let dao_id = self.dao_counter.get_or_default() + 1;
        self.dao_counter.set(dao_id);

        let info = DaoInfo {
            token_address,
            governance_address,
            creator: self.env().caller(),
            created_at: self.env().get_block_time(),
        };

        // Add to list
        let mut current_list = self.daos.get_or_default();
        current_list.push(info.clone());
        self.daos.set(current_list);

        // Store by ID for quick lookup
        self.dao_by_id.set(&dao_id, info);

        dao_id
    }

    /// Get all DAOs
    pub fn get_all_daos(&self) -> Vec<DaoInfo> {
        self.daos.get_or_default()
    }

    /// Get DAO by ID
    pub fn get_dao(&self, dao_id: u64) -> Option<DaoInfo> {
        self.dao_by_id.get(&dao_id)
    }

    /// Get total number of DAOs
    pub fn get_dao_count(&self) -> u64 {
        self.dao_counter.get_or_default()
    }

    /// Get DAOs created by a specific address
    pub fn get_daos_by_creator(&self, creator: Address) -> Vec<DaoInfo> {
        self.daos
            .get_or_default()
            .into_iter()
            .filter(|dao| dao.creator == creator)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, NoArgs};

    #[test]
    fn test_registry_init() {
        let env = odra_test::env();
        let registry = DaoRegistry::deploy(&env, NoArgs);

        assert_eq!(registry.get_dao_count(), 0);
        assert_eq!(registry.get_all_daos().len(), 0);
    }

    #[test]
    fn test_register_dao() {
        let env = odra_test::env();
        let creator = env.get_account(0);
        let mut registry = DaoRegistry::deploy(&env, NoArgs);

        env.set_caller(creator);
        let dao_id = registry.register_dao(
            creator, // Mock token address
            creator, // Mock governance address
        );

        assert_eq!(dao_id, 1);
        assert_eq!(registry.get_dao_count(), 1);

        let dao = registry.get_dao(dao_id).unwrap();
        assert_eq!(dao.token_address, creator);
        assert_eq!(dao.governance_address, creator);
    }
}
