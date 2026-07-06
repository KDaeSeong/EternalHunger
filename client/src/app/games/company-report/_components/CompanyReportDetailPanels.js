import CompanyReportArchiveLedgerPanels from './CompanyReportArchiveLedgerPanels';
import CompanyReportGlobalCapitalPanels from './CompanyReportGlobalCapitalPanels';
import CompanyReportVatInventoryPanels from './CompanyReportVatInventoryPanels';
import CompanyReportManagementPanels from './CompanyReportManagementPanels';

export default function CompanyReportDetailPanels(props) {
  return (
    <>
      <CompanyReportArchiveLedgerPanels {...props} />
      <CompanyReportGlobalCapitalPanels {...props} />
      <CompanyReportVatInventoryPanels {...props} />
      <CompanyReportManagementPanels {...props} />
    </>
  );
}
