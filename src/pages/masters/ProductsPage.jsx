import { useState, useEffect, useCallback, useContext } from 'react'
import { Package, Plus, Edit, Trash2, ChevronDown, ChevronRight, Layers, FlaskConical, Sprout } from 'lucide-react'
import toast from 'react-hot-toast'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'
import ConfirmDialog from '../../components/ConfirmDialog'
import { SeasonContext } from '../../context/SeasonContext'
import { useCompany } from '../../context/CompanyContext'

const UNITS = ['Bottle', 'Ltr', 'Kg', 'Box', 'Jar', 'Bag']
const CATEGORIES = ['Fertilizer', 'Pesticide', 'Biostimulant']

const emptyProduct = {
  name: '',
  category: 'Fertilizer',
  hsn_code: '',
  unit: 'Bottle',
  mrp: '',
  dealer_price: ''
}

const emptyBatch = {
  batch_no: '',
  mfg_date: '',
  expiry_date: ''
}

export default function ProductsPage() {
  const { activeSeason } = useContext(SeasonContext)
  const { userRole } = useCompany()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState({ ...emptyProduct })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Expandable rows - batches
  const [expandedProductId, setExpandedProductId] = useState(null)
  const [batches, setBatches] = useState([])
  const [batchesLoading, setBatchesLoading] = useState(false)

  // Batch modal
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchForm, setBatchForm] = useState({ ...emptyBatch })
  const [batchErrors, setBatchErrors] = useState({})
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchProductId, setBatchProductId] = useState(null)

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await window.db.invoke('products:getAll')
      setProducts(data || [])
    } catch (err) {
      toast.error('Failed to load products')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const fetchBatches = useCallback(async (productId) => {
    try {
      setBatchesLoading(true)
      const data = await window.db.invoke('batches:getByProduct', productId)
      setBatches(data || [])
    } catch (err) {
      toast.error('Failed to load batches')
      console.error(err)
    } finally {
      setBatchesLoading(false)
    }
  }, [])

  // Expand / collapse row
  const handleRowClick = (row) => {
    if (expandedProductId === row.id) {
      setExpandedProductId(null)
      setBatches([])
    } else {
      setExpandedProductId(row.id)
      fetchBatches(row.id)
    }
  }

  // Product form handlers
  const openAddModal = () => {
    setEditingProduct(null)
    setForm({ ...emptyProduct })
    setErrors({})
    setModalOpen(true)
  }

  const openEditModal = (product) => {
    setEditingProduct(product)
    setForm({
      name: product.name || '',
      category: product.category || 'Fertilizer',
      hsn_code: product.hsn_code || '',
      unit: product.unit || 'Bottle',
      mrp: product.mrp ?? '',
      dealer_price: product.dealer_price ?? ''
    })
    setErrors({})
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingProduct(null)
    setForm({ ...emptyProduct })
    setErrors({})
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Product name is required'
    if (!form.category) errs.category = 'Category is required'
    return errs
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    try {
      setSaving(true)
      const payload = {
        name: form.name.trim(),
        category: form.category,
        hsn_code: form.hsn_code.trim(),
        unit: form.unit,
        mrp: form.mrp ? parseFloat(form.mrp) : 0,
        dealer_price: form.dealer_price ? parseFloat(form.dealer_price) : 0
      }

      if (editingProduct) {
        await window.db.invoke('products:update', { id: editingProduct.id, ...payload })
        toast.success('Product updated successfully')
      } else {
        await window.db.invoke('products:add', payload)
        toast.success('Product added successfully')
      }

      closeModal()
      fetchProducts()
    } catch (err) {
      toast.error(editingProduct ? 'Failed to update product' : 'Failed to add product')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Delete handlers
  const openDelete = (product) => {
    setDeleteTarget(product)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await window.db.invoke('products:delete', deleteTarget.id)
      toast.success('Product deleted successfully')
      if (expandedProductId === deleteTarget.id) {
        setExpandedProductId(null)
        setBatches([])
      }
      fetchProducts()
    } catch (err) {
      toast.error('Failed to delete product')
      console.error(err)
    } finally {
      setDeleteOpen(false)
      setDeleteTarget(null)
    }
  }

  // Batch handlers
  const openBatchModal = (productId) => {
    const date = new Date()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    let prefix = 'ABX'
    let year2 = String(date.getFullYear()).slice(2)
    if (activeSeason) {
      prefix = activeSeason.type === 'kharif' ? 'ABK' : 'ABR'
      year2 = String(activeSeason.year).slice(2)
    }
    const defaultBatchNo = `${prefix}${year2}${m}`

    setBatchProductId(productId)
    setBatchForm({ ...emptyBatch, batch_no: defaultBatchNo })
    setBatchErrors({})
    setBatchModalOpen(true)
  }

  const closeBatchModal = () => {
    setBatchModalOpen(false)
    setBatchProductId(null)
    setBatchForm({ ...emptyBatch })
    setBatchErrors({})
  }

  const handleSaveBatch = async () => {
    const errs = {}
    if (!batchForm.batch_no.trim()) errs.batch_no = 'Batch number is required'
    if (Object.keys(errs).length) {
      setBatchErrors(errs)
      return
    }

    try {
      setBatchSaving(true)
      await window.db.invoke('batches:add', {
        product_id: batchProductId,
        batch_no: batchForm.batch_no.trim(),
        mfg_date: batchForm.mfg_date || null,
        expiry_date: batchForm.expiry_date || null
      })
      toast.success('Batch added successfully')
      closeBatchModal()
      if (expandedProductId === batchProductId) {
        fetchBatches(batchProductId)
      }
    } catch (err) {
      toast.error('Failed to add batch')
      console.error(err)
    } finally {
      setBatchSaving(false)
    }
  }

  const formatCurrency = (val) => {
    if (val == null || val === '') return '—'
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <span className="text-slate-400 transition-transform duration-200">
            {expandedProductId === row.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <span className="font-medium text-slate-800">{val}</span>
        </div>
      )
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (val) => {
        const config = {
          'Fertilizer': { bg: 'bg-emerald-100 text-emerald-700', icon: Layers },
          'Pesticide': { bg: 'bg-purple-100 text-purple-700', icon: FlaskConical },
          'Biostimulant': { bg: 'bg-amber-100 text-amber-700', icon: Sprout }
        }[val] || { bg: 'bg-slate-100 text-slate-700', icon: Package };
        const Icon = config.icon;
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg}`}>
            <Icon size={12} />
            {val}
          </span>
        );
      }
    },
    { key: 'hsn_code', label: 'HSN Code', sortable: true },
    { key: 'unit', label: 'Unit', sortable: true },
    {
      key: 'mrp',
      label: 'MRP (₹)',
      sortable: true,
      render: (val) => <span className="font-mono text-slate-700">{formatCurrency(val)}</span>
    },
    {
      key: 'dealer_price',
      label: 'Dealer Price (₹)',
      sortable: true,
      render: (val) => <span className="font-mono text-slate-700">{formatCurrency(val)}</span>
    }
  ]

  // Build the expanded content for the DataTable row
  const renderExpandedRow = (row) => {
    if (expandedProductId !== row.id) return null

    return (
      <tr key={`expanded-${row.id}`}>
        <td colSpan={columns.length + 1} className="p-0">
          <div className="bg-slate-50 border-t border-b border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700">
                Batches for {row.name}
              </h4>
              {userRole !== 'data_entry' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    openBatchModal(row.id)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-medium transition"
                >
                  <Plus size={14} />
                  Add Batch
                </button>
              )}
            </div>

            {batchesLoading ? (
              <div className="text-center py-4 text-slate-500 text-sm">Loading batches...</div>
            ) : batches.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-sm">No batches found. Add your first batch above.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Batch No</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">MFG Date</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-800">{batch.batch_no}</td>
                        <td className="px-4 py-2 text-slate-600">{batch.mfg_date || '—'}</td>
                        <td className="px-4 py-2 text-slate-600">{batch.expiry_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-sm text-slate-500 mt-1">
            {products.length} product{products.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        {userRole !== 'data_entry' && (
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition"
          >
            <Plus size={18} />
            Add Product
          </button>
        )}
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={products}
        searchable={true}
        searchPlaceholder="Search products by name..."
        loading={loading}
        emptyMessage="No products found. Add your first product to get started."
        emptyIcon={Package}
          actions={(row) => userRole !== 'data_entry' ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); openEditModal(row); }}
              className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-slate-100 transition"
              title="Edit"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); openDelete(row); }}
              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </>
        ) : null}
        onRowClick={handleRowClick}
        renderExpandedRow={renderExpandedRow}
      />

      {/* Add/Edit Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="md"
      >
        <div className="space-y-4">
          <FormField label="Product Name" required error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Enter product name"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
          </FormField>

          <FormField label="Category" required error={errors.category}>
            <div className="flex gap-4">
              {CATEGORIES.map((cat) => (
                <label key={cat} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    value={cat}
                    checked={form.category === cat}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">{cat}</span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="HSN Code">
              <input
                type="text"
                value={form.hsn_code}
                onChange={(e) => setForm({ ...form, hsn_code: e.target.value })}
                placeholder="e.g. 31010099"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
              />
            </FormField>

            <FormField label="Unit">
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="MRP (₹)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.mrp}
                onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
              />
            </FormField>

            <FormField label="Dealer Price (₹)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.dealer_price}
                onChange={(e) => setForm({ ...form, dealer_price: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
              />
            </FormField>
          </div>

          {/* Modal actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={closeModal}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Batch Modal */}
      <Modal
        isOpen={batchModalOpen}
        onClose={closeBatchModal}
        title="Add Batch"
        size="md"
      >
        <div className="space-y-4">
          <FormField label="Batch Number" required error={batchErrors.batch_no}>
            <input
              type="text"
              value={batchForm.batch_no}
              onChange={(e) => setBatchForm({ ...batchForm, batch_no: e.target.value })}
              placeholder="e.g. B2025-001"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Manufacturing Date">
              <input
                type="date"
                value={batchForm.mfg_date}
                onChange={(e) => setBatchForm({ ...batchForm, mfg_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
              />
            </FormField>

            <FormField label="Expiry Date">
              <input
                type="date"
                value={batchForm.expiry_date}
                onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={closeBatchModal}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveBatch}
              disabled={batchSaving}
              className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              {batchSaving ? 'Saving...' : 'Add Batch'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleteOpen(false); setDeleteTarget(null) }}
        title="Delete Product?"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All associated batches will also be removed. This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
