import { useState, useEffect, useContext } from 'react'
import { Plus, Search, FileText, Trash2, RotateCcw, Eye, Edit } from 'lucide-react'
import { toast } from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'
import SearchableSelect from '../../components/SearchableSelect'
import ConfirmDialog from '../../components/ConfirmDialog'
import { SeasonContext } from '../../context/SeasonContext'
import { formatDate } from '../../lib/dateUtils'

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
        await window.db.invoke('saleReturns:update', [editId, {
          ...formData,
          sale_id: finalSaleId,
          season_id: activeSeason?.id,
          total_amount
        }])
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
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
        >
          <Plus size={20} />
          Record Sale Return
        </button>
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
        title={modalMode === 'create' ? 'Record Sale Return' : modalMode === 'edit' ? 'Edit Sale Return' : 'View Sale Return'}
        size="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Date" required>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border rounded-lg"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                disabled={modalMode === 'view'}
              />
            </FormField>

            <FormField label="Return No." required>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border rounded-lg bg-gray-50 font-medium"
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
            
            <div className="col-span-2">
              <FormField label="Reason for Return">
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})}
                  placeholder="e.g., Damaged goods, Expired, etc."
                  disabled={modalMode === 'view'}
                />
              </FormField>
            </div>
          </div>

          {/* Add Items Section */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Returned Items</h3>
            {modalMode !== 'view' && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_120px_auto] gap-2 mb-3 items-end">
                <div className="min-w-0">
                  <SearchableSelect
                    options={productOptions}
                    value={currentItem.product_id}
                    onChange={val => setCurrentItem({...currentItem, product_id: val})}
                    placeholder="Select Product..."
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Qty"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={currentItem.qty}
                    onChange={e => setCurrentItem({...currentItem, qty: e.target.value})}
                    step="0.01"
                    min="0.01"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Rate (₹)"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={currentItem.rate}
                    onChange={e => setCurrentItem({...currentItem, rate: e.target.value})}
                    step="0.01"
                    min="0.01"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {formData.items.length > 0 && (
              <table className="w-full text-sm mt-4 bg-white border rounded">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left py-2 px-3">Product</th>
                    <th className="text-right py-2 px-3">Qty</th>
                    <th className="text-right py-2 px-3">Rate</th>
                    <th className="text-right py-2 px-3">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="py-2 px-3">{item.product_name}</td>
                      <td className="text-right py-2 px-3">{item.qty} {item.unit}</td>
                      <td className="text-right py-2 px-3">₹{item.rate.toFixed(2)}</td>
                      <td className="text-right font-medium py-2 px-3">₹{item.amount.toFixed(2)}</td>
                      <td className="text-right py-2 px-3">
                        {modalMode !== 'view' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-bold bg-gray-50">
                    <td colSpan="3" className="text-right py-3 px-3">Total Return Amount:</td>
                    <td className="text-right py-3 px-3 text-lg text-primary-700">
                      ₹{formData.items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
            >
              {modalMode === 'view' ? 'Close' : 'Cancel'}
            </button>
            {modalMode !== 'view' && (
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                {modalMode === 'edit' ? 'Update Return' : 'Save Return'}
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
