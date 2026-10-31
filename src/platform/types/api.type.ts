/** 分页查询接口的统一响应结构。 */
export interface PageData<T> {
  /** 当前页码。 */
  pageNum: number
  /** 每页记录数。 */
  pageSize: number
  /** 符合条件的记录总数。 */
  total: number
  /** 总页数。 */
  totalPages: number
  /** 当前页记录。 */
  records: T[]
}
