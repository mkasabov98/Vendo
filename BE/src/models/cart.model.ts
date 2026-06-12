import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { DiscountCode } from "./discountCode.model";

interface CartAttributes {
    id: number;
    userId: number;
    discountCodeId: number | null;
}

interface CartCreationAttributes extends Optional<CartAttributes, "id" | "discountCodeId"> {}

export class Cart
    extends Model<CartAttributes, CartCreationAttributes>
    implements CartAttributes
{
    public id!: number;
    public userId!: number;
    public discountCodeId!: number | null;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Cart.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true,
        },
        userId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        discountCodeId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            defaultValue: null,
            references: { model: DiscountCode, key: 'id'}
        },
    },
    {
        sequelize,
        tableName: "Carts",
        modelName: "Cart",
    }
);
