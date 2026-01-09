use syndicate::token::Token;         // Needed just to register the WASM file
use syndicate::governance::Governance; // Needed just to register the WASM file
use syndicate::registry::DaoRegistry;
use odra::{host::{HostEnv, NoArgs}, prelude::Addressable};
use odra_cli::{
    DeployedContractsContainer, DeployerExt, OdraCli, deploy::DeployScript
};

/// --- THE INFRASTRUCTURE DEPLOYER ---
/// Only deploys the Registry. The Token/Gov are deployed by users via Frontend.
pub struct InfrastructureDeployer;

impl DeployScript for InfrastructureDeployer {
    fn deploy(
        &self,
        env: &HostEnv,
        container: &mut DeployedContractsContainer
    ) -> Result<(), odra_cli::deploy::Error> {
        
        println!("--- Deploying Registry (The DAO Factory) ---");
        
        // We only deploy the Registry
        let registry = DaoRegistry::load_or_deploy(
            &env,
            NoArgs,
            container,
            500_000_000_000 // Gas Limit
        )?;
        
        println!("✅ Registry Deployed at: {:?}", registry.address());
        println!("👉 COPY THIS ADDRESS to your Frontend config!");

        Ok(())
    }
}

/// --- MAIN ---
pub fn main() {
    OdraCli::new()
        .about("Syndicate Infrastructure Deployer")
        .deploy(InfrastructureDeployer)
        // CRITICAL: We still register Token/Gov here so the CLI *compiles* them 
        // and puts the .wasm files in the correct folder for your frontend to find.
        .contract::<Token>()
        .contract::<Governance>()
        .contract::<DaoRegistry>()
        .build()
        .run();
}