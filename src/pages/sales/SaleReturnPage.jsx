import { useState, useEffect, useContext } from 'react'
import { Plus, Search, FileText, Trash2, RotateCcw, Eye, Edit, Package, FileWarning, RefreshCw, Box, Download } from 'lucide-react'
import { toast } from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'
import SearchableSelect from '../../components/SearchableSelect'
import ConfirmDialog from '../../components/ConfirmDialog'
import { SeasonContext } from '../../context/SeasonContext'
import { formatDate } from '../../lib/dateUtils'
import { exportToExcel } from '../../lib/excelExport'

export default function SaleReturnPage() {
  const { activeSeason } = useContext(SeasonContext)
  const [returns, setReturns] = useState([])
  const [parties, setParties] = useState([])
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create', 'edit', 'view'
  const [deleteId, setDeleteId] = useState(null)
  const [editId, setEditId] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    party_id: '',
    sale_id: '',
    reason: '',
    items: []
  })
  
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    qty: '',
    rate: ''
  })

  useEffect(() => {
    if (activeSeason) {
      loadData()
    }
  }, [activeSeason])

  const loadData = async () => {
    try {
      setLoading(true)
      const [returnsData, partiesData, salesData, productsData] = await Promise.all([
        window.db.invoke('saleReturns:getAll', { season_id: activeSeason?.id }),
        window.db.invoke('parties:getAll'),
        window.db.invoke('sales:getAll', { season_id: activeSeason?.id }),
        window.db.invoke('products:getAll')
      ])
      
      setReturns(returnsData || [])
      setParties(partiesData || [])
      setSales(salesData || [])
      setProducts(productsData || [])
    } catch (error) {
      toast.error('Failed to load data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = async () => {
    try {
      const nextNo = await window.db.invoke('saleReturns:getNextReturnNo')
      setFormData({
        date: new Date().toISOString().split('T')[0],
        party_id: '',
        sale_id: '',
        return_no: nextNo,
        reason: '',
        items: []
      })
      setModalMode('create')
      setEditId(null)
      setIsModalOpen(true)
    } catch (error) {
      toast.error('Failed to generate return number')
    }
  }

  const handleEdit = async (row) => {
    try {
      setLoading(true)
      const data = await window.db.invoke('saleReturns:getById', row.id)
      setFormData({
        date: data.saleReturn.date,
        party_id: data.saleReturn.party_id,
        sale_id: data.saleReturn.sale_id || '',
        return_no: data.saleReturn.return_no,
        reason: data.saleReturn.reason || '',
        items: data.items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          unit: item.unit,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount
        }))
      })
      setModalMode('edit')
      setEditId(row.id)
      setIsModalOpen(true)
    } catch (error) {
      toast.error('Failed to load return details')
    } finally {
      setLoading(false)
    }
  }

  const handleView = async (row) => {
    try {
      setLoading(true)
      const data = await window.db.invoke('saleReturns:getById', row.id)
      setFormData({
        date: data.saleReturn.date,
        party_id: data.saleReturn.party_id,
        sale_id: data.saleReturn.sale_id || '',
        return_no: data.saleReturn.return_no,
        reason: data.saleReturn.reason || '',
        items: data.items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          unit: item.unit,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount
        }))
      })
      setModalMode('view')
      setEditId(row.id)
      setIsModalOpen(true)
    } catch (error) {
      toast.error('Failed to load return details')
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = () => {
    if (!currentItem.product_id || !currentItem.qty || !currentItem.rate) {
      toast.error('Please fill all item fields')
      return
    }

    const product = products.find(p => p.id === currentItem.product_id)
    const qty = parseFloat(currentItem.qty)
    const rate = parseFloat(currentItem.rate)
    const amount = qty * rate

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: product.id,
        product_name: product.name,
        unit: product.unit,
        qty,
        rate,
        amount
      }]
    }))

    setCurrentItem({ product_id: '', qty: '', rate: '' })
  }

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.party_id) {
      toast.error('Please select a party')
      return
    }
    if (formData.items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    const total_amount = formData.items.reduce((sum, item) => sum + item.amount, 0)
    const finalSaleId = formData.sale_id === '' ? null : formData.sale_id

    try {
      if (modalMode === 'edit') {
        await window.db.invoke('saleReturns:update', editId, {
          ...formData,
          sale_id: finalSaleId,
          season_id: activeSeason?.id,
          total_amount
        })
        toast.success('Sale return updated successfully')
      } else {
        await window.db.invoke('saleReturns:add', {
          ...formData,
          sale_id: finalSaleId,
          season_id: activeSeason?.id,
          total_amount
        })
        toast.success('Sale return recorded successfully')
      }
      setIsModalOpen(false)
      loadData()
    } catch (error) {
      toast.error(`Failed to ${modalMode} sale return`)
      console.error(error)
    }
  }

  const handleDelete = async () => {
    try {
      await window.db.invoke('saleReturns:delete', deleteId)
      toast.success('Sale return deleted successfully')
      setDeleteId(null)
      loadData()
    } catch (error) {
      toast.error('Failed to delete sale return')
      console.error(error)
    }
  }

  const filteredReturns = returns.filter(r => 
    r.return_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.party_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.original_invoice?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const partyOptions = parties.map(p => ({ value: p.id, label: p.name }))
  const saleOptions = sales
    .filter(s => s.party_id === formData.party_id)
    .map(s => ({ value: s.id, label: s.invoice_no }))
  const productOptions = products.map(p => ({ value: p.id, label: p.name }))

  const columns = [
    { key: 'date', label: 'Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'return_no', label: 'Return No', sortable: true },
    { key: 'party_name', label: 'Party', sortable: true },
    { key: 'original_invoice', label: 'Original Invoice', sortable: true },
    { key: 'total_amount', label: 'Total Amount', sortable: true, render: (val) => `₹${Number(val || 0).toFixed(2)}` },
    { key: 'reason', label: 'Reason' }
  ]

  const tableActions = [
    { label: 'View', icon: Eye, onClick: (row) => handleView(row) },
    { label: 'Edit', icon: Edit, onClick: (row) => handleEdit(row) },
    { label: 'Delete', icon: Trash2, onClick: (row) => setDeleteId(row.id), variant: 'danger' }
  ]

  const handleExport = async () => {
    try {
      const exportData = filteredReturns.map(r => ({
        date: formatDate(r.date),
        return_no: r.return_no,
        party_name: r.party_name,
        original_invoice: r.original_invoice,
        total_amount: Number(r.total_amount || 0),
        reason: r.reason
      }))

      const excelColumns = [
        { label: 'Date', key: 'date', width: 15 },
        { label: 'Return No', key: 'return_no', width: 15 },
        { label: 'Party Name', key: 'party_name', width: 30 },
        { label: 'Original Invoice', key: 'original_invoice', width: 20 },
        { label: 'Total Amount (₹)', key: 'total_amount', width: 20, style: { numFmt: '₹#,##0.00' } },
        { label: 'Reason', key: 'reason', width: 30 }
      ]
      
      const totalAmount = exportData.reduce((sum, r) => sum + r.total_amount, 0)
      
      await exportToExcel({
        title: 'Sale Returns Report',
        columns: excelColumns,
        data: exportData,
        valueKey: 'total_amount',
        accentColor: 'D4AF37', // Beautiful golden color as requested
        filename: `Sale_Returns_${formatDate(new Date().toISOString()).replace(/\//g, '-')}`
      })
    } catch (err) {
      console.error(err)
      toast.error('Export failed: ' + err.message)
    }
  }

  if (!activeSeason) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Please select an active season first.
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="p-6 pb-4 shrink-0 flex justify-between items-end border-b bg-white">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw className="text-primary-600" /> Sale Returns
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {returns.length} returns recorded
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors border border-slate-300"
          >
            <Download size={20} />
            Export Excel
          </button>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
          >
            <Plus size={20} />
            Record Sale Return
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 bg-white rounded-lg border shadow-sm flex flex-col">
          <DataTable
            columns={columns}
            data={filteredReturns}
            loading={loading}
            searchable
            searchPlaceholder="Search by return no, party, or invoice..."
            emptyMessage="No sale returns found"
            emptyIcon={RotateCcw}
            actions={tableActions}
            renderMobileCard={(row) => (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-500">{formatDate(row.date)}</p>
                    <p className="font-bold text-slate-800">{row.return_no}</p>
                  </div>
                  <span className="font-semibold text-primary-700">₹{Number(row.total_amount || 0).toFixed(2)}</span>
                </div>
                <p className="text-sm text-slate-600">{row.party_name}</p>
                {row.reason && <p className="text-xs text-slate-400">{row.reason}</p>}
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button onClick={() => setDeleteId(row.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
          />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-primary-900">
            {modalMode === 'create' ? <RotateCcw size={24} className="text-primary-600" /> : modalMode === 'edit' ? <Edit size={24} className="text-primary-600" /> : <Eye size={24} className="text-primary-600" />}
            <span>{modalMode === 'create' ? 'Record Sale Return' : modalMode === 'edit' ? 'Edit Sale Return' : 'View Sale Return'}</span>
          </div>
        }
        size="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <FileWarning size={16} className="text-slate-500" /> Return Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Date" required>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-colors"
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  disabled={modalMode === 'view'}
                />
              </FormField>

              <FormField label="Return No." required>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-bold outline-none"
                  value={formData.return_no || ''}
                  readOnly
                />
              </FormField>

              <FormField label="Party" required>
                <SearchableSelect
                  options={partyOptions}
                  value={formData.party_id}
                  onChange={val => setFormData({...formData, party_id: val, sale_id: ''})}
                  placeholder="Select Party..."
                  disabled={modalMode === 'view'}
                />
              </FormField>

              <FormField label="Original Invoice (Optional)">
                <SearchableSelect
                  options={saleOptions}
                  value={formData.sale_id}
                  onChange={val => setFormData({...formData, sale_id: val})}
                  placeholder={formData.party_id ? "Select Invoice..." : "Select Party first..."}
                  disabled={!formData.party_id || modalMode === 'view'}
                />
              </FormField>
              
              <div className="col-span-1 md:col-span-2">
                <FormField label="Reason for Return">
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-colors"
                    value={formData.reason}
                    onChange={e => setFormData({...formData, reason: e.target.value})}
                    placeholder="e.g., Damaged goods, Expired, Wrong item delivered..."
                    disabled={modalMode === 'view'}
                  />
                </FormField>
              </div>
            </div>
          </div>

          {/* Add Items Section */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-inner">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
              <Package size={16} className="text-slate-500" /> Returned Items
            </h3>
            {modalMode !== 'view' && (
              <div className="flex flex-col sm:flex-row gap-3 mb-4 items-end">
                <div className="flex-1 w-full">
                  <SearchableSelect
                    options={productOptions}
                    value={currentItem.product_id}
                    onChange={val => setCurrentItem({...currentItem, product_id: val})}
                    placeholder="Select Product..."
                  />
                </div>
                <div className="w-full sm:w-28">
                  <input
                    type="number"
                    placeholder="Qty"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={currentItem.qty}
                    onChange={e => setCurrentItem({...currentItem, qty: e.target.value})}
                    step="0.01"
                    min="0.01"
                  />
                </div>
                <div className="w-full sm:w-32">
                  <input
                    type="number"
                    placeholder="Rate (₹)"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={currentItem.rate}
                    onChange={e => setCurrentItem({...currentItem, rate: e.target.value})}
                    step="0.01"
                    min="0.01"
                  />
                </div>
                <div className="w-full sm:w-auto mt-2 sm:mt-0">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={18} /> Add
                  </button>
                </div>
              </div>
            )}

            {formData.items.length > 0 ? (
              <div className="overflow-hidden border border-slate-200 rounded-xl mt-5 shadow-sm bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-xs">
                    <tr>
                      <th className="py-3 px-4">Product</th>
                      <th className="text-right py-3 px-4">Qty</th>
                      <th className="text-right py-3 px-4">Rate</th>
                      <th className="text-right py-3 px-4">Amount</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-800">
                          <div className="flex items-center gap-2">
                            <Box size={14} className="text-primary-500" />
                            {item.product_name}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 text-slate-600">{item.qty} <span className="text-xs text-slate-400">{item.unit}</span></td>
                        <td className="text-right py-3 px-4 text-slate-600">₹{item.rate.toFixed(2)}</td>
                        <td className="text-right py-3 px-4 font-bold text-slate-800">₹{item.amount.toFixed(2)}</td>
                        <td className="text-right py-3 px-4">
                          {modalMode !== 'view' && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors"
                              title="Remove Item"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan="3" className="text-right py-4 px-4 font-bold text-slate-600 uppercase text-xs tracking-wider">Total Return Amount:</td>
                      <td className="text-right py-4 px-4 text-lg font-black text-primary-700">
                        ₹{formData.items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300 mt-4">
                <Package size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500 font-medium">No items added to this return yet.</p>
                <p className="text-slate-400 text-sm mt-1">Select a product and add quantity to begin.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2.5 text-slate-700 hover:bg-slate-100 rounded-lg font-bold transition-colors"
            >
              {modalMode === 'view' ? 'Close' : 'Cancel'}
            </button>
            {modalMode !== 'view' && (
              <button
                type="submit"
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold shadow-lg shadow-primary-500/30 transition-all flex items-center gap-2"
              >
                {modalMode === 'edit' ? <><RefreshCw size={18} /> Update Return</> : <><Plus size={18} /> Save Return</>}
              </button>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Sale Return"
        message="Are you sure you want to delete this return? This will adjust the party's ledger balance."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
